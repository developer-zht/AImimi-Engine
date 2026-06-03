# FFT Ocean Pipeline

这篇文档解释当前 FFT Ocean 主线的核心数据流：

```text
JONSWAP 参数
  -> 初始频谱 h0(k)
  -> 实时频谱 h(k,t)
  -> GPU Stockham IFFT
  -> displacement / gradient / jacobian / foam 纹理
  -> vertex shader 位移网格
  -> fragment shader 光照、法线、泡沫、雾效
```

对应当前主线文件：

```text
src/scenes/water/fftOcean/loadFFTOceanScene-multi-layers-v3.ts
src/renderers/passes/fft/FFTOceanComputePass-multi-layers-v3.ts
src/simulation/ocean/fft/InitialSpectrum.ts
src/simulation/ocean/spectrums/JONSWAPSpectrum.ts
src/simulation/ocean/fft/RealtimeSpectrumGPU.ts
src/shaders/water/fftOcean/compute/realtimeSpectrum/fragment.frag
src/shaders/water/fftOcean/compute/fftStockham/FFTStockham2D.frag
src/shaders/water/fftOcean/compute/packedAssembly/fragment.frag
src/shaders/water/fftOcean/vertex-multi-layers.vert
src/shaders/water/fftOcean/fragment-multi-layers.frag
```

## 1. 整体图

```text
CPU 初始化阶段:

OceanParams
  -> JONSWAPSpectrum.calculateH0Magnitude(kx, kz)
  -> InitialSpectrum
      -> h0 texture
      -> h0Conj texture

每帧 GPU 阶段:

h0 / h0Conj texture
  -> realtimeSpectrum fragment shader
      -> packed frequency textures
  -> FFTStockham2D fragment shader
      -> packed spatial textures
  -> packedAssembly fragment shader
      -> displacement map
      -> gradient map
      -> derivative / jacobian map
  -> vertex-multi-layers.vert
      -> displaced ocean mesh
  -> fragment-multi-layers.frag
      -> final water color
```

## 2. h0(k) 是什么？

`h0(k)` 是初始频谱。它不是某个空间点的高度，而是“频率 k 这类波”的复数振幅。

二维海面中：

```text
k = (kx, kz)
```

其中：

```text
方向 angle(k):
  决定这类波沿什么方向排列。

长度 |k|:
  决定波长。|k| 越大，波长越短。

复数相位:
  决定这类波在空间中的偏移。

复数幅度:
  决定这类波有多强。
```

波长和波数的关系：

```text
lambda = 2 * PI / |k|
```

所以：

```text
小 |k| -> 长波
大 |k| -> 短波
```

## 3. JONSWAP 负责什么？

JONSWAP 频谱回答的是：

```text
在给定风速、fetch、水深、方向扩散等参数后，
每个 k 上应该有多少波浪能量？
```

项目中的核心输入包括：

```text
windSpeed:
  风速。通常越大，波能越强，主波长也会变长。

fetch:
  风吹过海面的距离。fetch 越大，海浪越充分发展。

windDirection:
  风向。影响方向能量分布。

spreadBlend:
  方向集中程度。0 更接近各向同性，1 更集中到风向。

swell:
  低频涌浪方向集中度。

peakEnhancement:
  峰值增强因子。越大，能量越集中在主频附近。

shortWavesFade:
  短波衰减。越大，越会压掉高频短波。

kMin / kMax:
  当前 cascade 层允许表达的波数范围。
```

`JONSWAPSpectrum.calculateH0Magnitude(kx, kz, params)` 输出的是每个 k 的初始幅度规模。

## 4. 为什么 h0(k) 要乘随机数？

如果只按频谱能量生成波，画面会过于规则。真实海面不是几条完全确定的正弦波，而是很多随机相位、随机幅度的波叠加。

所以项目用高斯随机数生成复数扰动：

```text
h0(k) = gaussianComplex * sqrt(energy(k))
```

直觉上：

```text
频谱决定“统计规律”
随机数决定“具体这一次海面长什么样”
```

这样同一组风速和 fetch 可以生成不同但风格一致的海面。

## 5. h0Conj 是什么？

IFFT 后我们希望得到真实空间中的实数高度场，而不是复数高度场。为了让空间结果为实数，频域需要满足 Hermitian 共轭对称：

```text
h(-k) = conj(h(k))
```

项目中会预先构造：

```text
h0(k)
h0Conj(k) = conj(h0(-k))
```

实时演化时会同时使用它们。

## 6. h(k,t) 怎么演化？

`h0(k)` 是 t=0 时刻的频谱。海面要动起来，就要让每个频率按照自己的角速度随时间旋转相位。

核心公式：

```text
h(k,t) = h0(k) * exp(i * omega(k) * t)
       + conj(h0(-k)) * exp(-i * omega(k) * t)
```

深水近似下：

```text
omega(k) = sqrt(g * |k|)
```

直觉：

```text
长波和短波的 omega 不同，所以运动速度不同。
exp(i * omega * t) 是复平面旋转。
两个共轭方向一起算，保证最终空间域是实数。
```

对应文件：

```text
src/shaders/water/fftOcean/compute/realtimeSpectrum/fragment.frag
src/simulation/ocean/fft/RealtimeSpectrumGPU.ts
```

## 7. realtimeSpectrum shader 为什么输出 4 张 packed 纹理？

海面渲染不只需要高度 `Dy`，还需要：

```text
Dx, Dz:
  水平位移，用于 choppy waves。

dDy/dx, dDy/dz:
  高度梯度，用于重建法线。

dDx/dx, dDz/dz, dDz/dx:
  位移导数，用于 Jacobian 和 foam。
```

这些量都可以在频域里通过乘 `i * k` 得到。

为了减少 pass 数量，shader 会把多个复数信号 packed 到 4 张 MRT 输出里：

```text
pack0 = height + i * dDz_dx
pack1 = dispX  + i * dispZ
pack2 = slopeX + i * slopeZ
pack3 = dDx_dx + i * dDz_dz
```

之后对这些 packed 结果一起做 IFFT。

## 8. 为什么要 IFFT？

频域数据不能直接当成海面画。频域表示的是：

```text
每一种频率的波有多强
```

渲染需要的是空间域：

```text
每一个位置 (x,z) 的高度、位移、斜率
```

IFFT 做的就是：

```text
frequency domain -> spatial domain
```

也就是：

```text
h(k,t) -> h(x,z,t)
```

数学上可以理解成把所有频率的正弦波叠加回空间：

```text
height(x,z,t) = sum over k of h(k,t) * exp(i * dot(k, (x,z)))
```

## 9. 为什么用 Stockham IFFT？

FFT/IFFT 的目标是高效计算大量频率的叠加。直接求和复杂度很高，而 FFT 可以把复杂度降到：

```text
O(N^2 log N)
```

本项目使用 Stockham 形式的 FFT shader。它的优点是：

- 适合 GPU ping-pong FBO。
- 每个 stage 结构规则。
- 不需要单独做显式 bit-reversal pass。

2D IFFT 可以拆成：

```text
水平 N 条 1D IFFT
  -> 垂直 N 条 1D IFFT
```

对于 N x N 纹理，每个方向需要：

```text
log2(N)
```

个 stage。

对应文件：

```text
src/shaders/water/fftOcean/compute/fftStockham/FFTStockham2D.frag
```

## 10. Assembly pass 做什么？

Stockham IFFT 后得到的是 packed 的空间域复数结果。Assembly pass 会把它们解包成渲染阶段真正要用的纹理。

输出 1：displacement

```text
RGBA = (Dx, Dy, Dz, foam)
```

用途：

```text
vertex shader 用 Dx / Dy / Dz 移动网格顶点。
fragment shader 用 foam 通道混合泡沫。
```

输出 2：gradient

```text
RG = (dDy/dx, dDy/dz)
```

用途：

```text
fragment shader 用它重建海面法线。
```

输出 3：derivatives / jacobian

```text
RGBA = (dDx/dx, dDz/dz, dDz/dx, detJ)
```

用途：

```text
detJ 用来判断波峰是否折叠。
折叠区域会触发 foam。
```

对应文件：

```text
src/shaders/water/fftOcean/compute/packedAssembly/fragment.frag
```

## 11. Jacobian 和 foam 的关系

水平位移会把原始网格点：

```text
(x, z)
```

移动到：

```text
(x + Dx, z + Dz)
```

这个映射的 Jacobian determinant 可以表示局部是否发生折叠：

```text
detJ > 0:
  局部还没有折叠。

detJ -> 0:
  接近折叠边界。

detJ < 0:
  表面发生折叠，通常对应破碎波峰。
```

foam 的直觉：

```text
波峰折叠 -> 破碎 -> 产生泡沫
```

项目里不会让 foam 一帧出现一帧消失，而是用上一帧 foam 做累积和衰减：

```text
foam_t = prevFoam * exp(-decayRate) + newFoam
```

这样泡沫会有持续时间。

## 12. Vertex shader 怎么消费 displacement？

vertex shader 采样每层 displacement map：

```text
d0 = texture(displacementMap0, worldXZ / layerSize0)
d1 = texture(displacementMap1, worldXZ / layerSize1)
d2 = texture(displacementMap2, worldXZ / layerSize2)
d3 = texture(displacementMap3, worldXZ / layerSize3)
```

然后按权重叠加：

```text
D = d0 * contribute0
  + d1 * contribute1
  + d2 * contribute2
  + d3 * contribute3
```

原始平面顶点：

```text
P = (x, 0, z)
```

变成：

```text
P' = (x + D.x, D.y, z + D.z)
```

对应文件：

```text
src/shaders/water/fftOcean/vertex-multi-layers.vert
```

## 13. Fragment shader 怎么消费 gradient / jacobian / foam？

fragment shader 负责最终水面颜色。

它会采样 gradient：

```text
slope = (dDy/dx, dDy/dz)
normal = normalize((-slope.x, 1, -slope.y))
```

它会采样 foam：

```text
foamMask = displacement.a
```

它会采样 jacobian：

```text
jacobian = derivativeMap.a
```

然后综合计算：

- Fresnel：水面掠射角反射更强。
- Cook-Torrance：高光。
- SSS：波峰透光和水体散射。
- IBL：环境反射。
- Foam：泡沫颜色混合。
- Fog：远处大气透视。

对应文件：

```text
src/shaders/water/fftOcean/fragment-multi-layers.frag
```

## 14. Cascade 为什么需要多层？

单张 FFT 贴图由两个参数决定能力：

```text
size:
  这张 FFT 贴图覆盖多少米的物理区域。

fftResolution:
  这张贴图有多少采样点。
```

如果 `size` 很大：

```text
能表达大浪，但单位距离采样点少，细节不足。
```

如果 `size` 很小：

```text
能表达细碎波，但表达不了长波。
```

所以项目使用 4 层 cascade：

```text
Layer 0: 大涌浪
Layer 1: 中尺度风浪
Layer 2: 短波
Layer 3: 毛细波
```

每层有自己的：

```text
size
fftResolution
kMin / kMax
windSpeed
fetch
choppiness
foam 参数
layerContribute
```

## 15. 调试建议

如果画面不对，建议按层排查：

```text
1. 几何是否正确？
   开 wireframe。

2. 频谱是否正确？
   只开一个 cascade layer。

3. 位移是否正确？
   直接可视化 displacement。

4. 法线是否正确？
   输出 normal 或 slope 为颜色。

5. foam 是否正确？
   输出 foam mask 或 jacobian。

6. 光照是否正确？
   暂时关闭 foam / fog / IBL / SSS，只看基础 shading。
```

特别注意：

```text
texture.x / texture.y
world.x / world.z
kx / kz
row / column
```

这些轴向约定必须在 CPU、GPU spectrum、IFFT、vertex shader、fragment shader 中保持一致。
