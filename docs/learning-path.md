# Learning Path

这份学习路线按“先渲染引擎，再普通水面，最后 FFT Ocean”的顺序组织。它的目标不是一次性解释所有代码，而是告诉你每一步该看哪些文件、该理解什么、暂时可以跳过什么。

如果你是第一次接触这个项目，建议不要直接从 FFT shader 开始。FFT Ocean 涉及 WebGL、FBO、复数、频谱、IFFT、材质、光照和调试约定，直接看最终版本会很容易迷路。

## Stage 0：先跑起来

目标：确认项目能启动，并知道当前主场景是哪一个。

阅读文件：

```text
src/main.ts
src/scenes/water/fftOcean/loadFFTOceanScene-multi-layers-v3.ts
```

你应该能回答：

- canvas 是在哪里获取的？
- `Engine.create(canvas)` 做了什么？
- 当前默认加载的是哪个 scene？
- `engine.init()`、`engine.loadScene()`、`engine.start()` 的顺序是什么？

暂时不用深究：

- PRT
- LUT 生成
- deprecated 目录
- backup shader
- WasmHeight 实验路径

## Stage 1：理解最小渲染引擎

目标：理解一帧画面是如何被组织出来的。

阅读文件：

```text
src/engine.ts
src/renderers/WebGLRenderer.ts
src/renderers/README.md
src/objects/README.md
src/shaders/README.md
```

核心概念：

```text
Engine
  负责 WebGL 上下文、相机、控制器、GUI、性能监控、FrameClock 和主循环。

WebGLRenderer
  负责按顺序执行 RenderPass。

RenderPass
  代表一帧中的一个阶段，例如 forward、shadow、fft、overlay。

BaseRenderer
  负责把一个 Mesh + Material + Shader 画出来。

Mesh
  负责几何数据和 VBO / IBO。

Material
  负责 uniforms 和 textures。

Shader
  负责编译、链接和缓存 attribute / uniform location。
```

你应该能画出这张图：

```text
Engine
  -> FrameClock.tick()
  -> updaters.update()
  -> WebGLRenderer.render(frameContext)
      -> RenderPass.execute()
          -> BaseRenderer.draw()
              -> Mesh.bind()
              -> Material.applyUniforms()
              -> gl.drawElements()
```

## Stage 2：理解普通水面

目标：先理解不需要 FFT 的水面。

阅读文件：

```text
src/scenes/water/simpleWaves/loadSineWaveScene.ts
src/scenes/water/simpleWaves/loadGerstnerWaveScene.ts
src/shaders/water/simpleWaves/sineWave/vertex.vert
src/shaders/water/simpleWaves/gerstnerWave/vertex.vert
```

你需要理解：

- 正弦波为什么可以直接在 vertex shader 里计算。
- Gerstner wave 为什么不仅有高度位移，也有水平位移。
- 普通解析波和 FFT Ocean 的区别是什么。

一个简单对比：

```text
Sine / Gerstner:
  直接写几个公式，波形数量少，容易理解，适合入门。

FFT Ocean:
  从频谱生成大量波的叠加，尺度丰富，视觉更真实，但管线更复杂。
```

## Stage 3：理解单层 FFT Ocean

目标：先把 FFT Ocean 看成“一张频谱生成一张海面”。

阅读文件：

```text
src/scenes/water/fftOcean/loadFFTOceanScene-single-layer.ts
src/scenes/water/fftOcean/_config/fftOceanSceneConfig.ts
src/simulation/ocean/fft/InitialSpectrum.ts
src/simulation/ocean/spectrums/JONSWAPSpectrum.ts
```

核心问题：

```text
h0(k) 是什么？
  t=0 时刻的初始频域波幅。

k 是什么？
  k = (kx, kz)，表示一个二维波数。方向决定波的排列方向，长度决定波长。

JONSWAP 做什么？
  根据风速、fetch、方向扩散等参数，估计每个 k 上应该有多少波浪能量。

为什么要随机数？
  真实海面不是规则重复的几条波，而是符合统计规律的随机波场。
```

你应该能回答：

- `windSpeed` 增大通常会发生什么？
- `fetch` 增大通常会发生什么？
- `peakEnhancement` 变大时，频谱会更集中还是更分散？
- `kMin / kMax` 为什么能控制某一层表达的波长范围？

## Stage 4：理解实时频谱 h(k,t)

目标：理解海面为什么会动。

阅读文件：

```text
src/simulation/ocean/fft/RealtimeSpectrumGPU.ts
src/shaders/water/fftOcean/compute/realtimeSpectrum/fragment.frag
```

核心公式：

```text
h(k,t) = h0(k) * exp(i * omega(k) * t)
       + conj(h0(-k)) * exp(-i * omega(k) * t)

omega(k) = sqrt(g * |k|)
```

直觉解释：

- `h0(k)` 是初始频谱。
- `exp(i * omega * t)` 让每个频率随时间旋转相位。
- 不同 k 的 `omega` 不同，所以不同波长的波速度不同。
- 加上 `conj(h0(-k))` 是为了保证 IFFT 后的空间结果是实数。

这个阶段输出的不是最终海面，而是多个 packed 的频域纹理。

## Stage 5：理解 GPU IFFT

目标：理解为什么需要 IFFT，以及 Stockham shader 在做什么。

阅读文件：

```text
src/shaders/water/fftOcean/compute/fftStockham/FFTStockham2D.frag
src/renderers/passes/fft/FFTOceanComputePass-multi-layers-v3.ts
```

为什么要 IFFT：

```text
频域 h(k,t):
  告诉你每种频率的波有多强、相位是多少。

空间域 height(x,z,t):
  告诉你每个网格点实际高度是多少。

IFFT:
  把频率列表转换成空间网格。
```

本项目的 GPU IFFT 做法：

```text
for horizontal stages:
  ping-pong FBO

for vertical stages:
  ping-pong FBO

最后输出 packed IFFT result
```

你应该能回答：

- 为什么 2D IFFT 可以拆成水平和垂直两个方向？
- 为什么每个方向需要 `log2(N)` 个 stage？
- ping-pong FBO 的作用是什么？
- 为什么 shader 中要处理复数乘法？

## Stage 6：理解 Assembly 输出

目标：理解 IFFT 结果如何变成渲染 shader 可以直接使用的贴图。

阅读文件：

```text
src/shaders/water/fftOcean/compute/packedAssembly/fragment.frag
```

Assembly pass 输出三张纹理：

```text
displacement:
  (Dx, Dy, Dz, foam)

gradient:
  (dDy/dx, dDy/dz)

derivatives:
  (dDx/dx, dDz/dz, dDz/dx, jacobian)
```

它还会做几件事：

- 应用 choppiness，让水平位移更明显。
- 修正斜率，减少折叠区域的法线伪影。
- 计算 Jacobian determinant，判断波峰是否发生折叠。
- 用历史 foam 做 EMA 累积，让泡沫不会一帧就消失。

## Stage 7：理解多层 Cascade

目标：理解为什么最终版本不是一张 FFT 贴图，而是 4 层。

阅读文件：

```text
src/scenes/water/fftOcean/_config/fftOceanSceneConfig-MultiLayers.ts
src/renderers/passes/fft/FFTOceanComputePass-multi-layers-v3.ts
src/shaders/water/fftOcean/vertex-multi-layers.vert
src/shaders/water/fftOcean/fragment-multi-layers.frag
```

核心直觉：

```text
单层 FFT 的 size 和 resolution 决定了它能表达的波长范围。

size 很大:
  能表达大浪，但细节不足。

size 很小:
  能表达细碎波，但缺少大尺度起伏。

multi-layer cascade:
  用多张 FFT 贴图分别负责不同波长范围。
```

本项目的层级可以理解为：

```text
Layer 0: 大涌浪，几十米到上百米
Layer 1: 风浪，十几米到几十米
Layer 2: 短波，几米级
Layer 3: 毛细波，小于一米到数米
```

你应该能回答：

- `size` 和 `fftResolution` 分别影响什么？
- `layerContribute` 是物理参数还是艺术参数？
- 为什么 fragment shader 可以选择混合不同层的 slope？

## Stage 8：理解海面主渲染

目标：理解 FFT 输出如何变成最终画面。

阅读文件：

```text
src/shaders/water/fftOcean/vertex-multi-layers.vert
src/shaders/water/fftOcean/fragment-multi-layers.frag
src/materials/water/FFTOceanMaterial-MultiLayers.ts
```

vertex shader 做：

```text
采样 4 层 displacement map
  -> 累加 Dx / Dy / Dz
  -> 移动网格顶点
  -> 输出世界坐标、采样坐标、波高等 varyings
```

fragment shader 做：

```text
采样 gradient map
  -> 重建法线

采样 jacobian / foam
  -> 泡沫混合

使用 Fresnel / Cook-Torrance / SSS / IBL / fog
  -> 得到最终颜色
```

## Stage 9：图形学调试

目标：学会定位渲染 bug，而不是只调参数。

阅读文件：

```text
src/simulation/ocean/fft/postmortem-fft-axis-misalignment.md
```

建议实验：

```text
1. 开 wireframe，只看几何。
2. 只打开一个 cascade layer。
3. 输出 slope 为颜色。
4. 输出 jacobian 为灰度。
5. 暂时关闭 foam / fog / IBL。
6. 对比 0 / 90 / 180 / 270 度相机角度。
```

要记住：

- 着色问题和几何问题要分离。
- 参数能改善画面，但不能解释结构性 bug。
- FFT 的 texture axis / world axis 约定必须端到端一致。
- 单看每个文件都“对称”，不代表跨文件组合后仍然正确。

## 推荐学习顺序总结

```text
main.ts
  -> engine.ts
  -> renderers/README.md
  -> simpleWaves
  -> InitialSpectrum / JONSWAP
  -> realtimeSpectrum shader
  -> FFTStockham2D shader
  -> packedAssembly shader
  -> FFTOceanComputePass-multi-layers-v3
  -> vertex-multi-layers
  -> fragment-multi-layers
  -> postmortem debug notes
```
