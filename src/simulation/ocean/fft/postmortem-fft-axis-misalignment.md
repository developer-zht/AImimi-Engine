# 08 · FFT 频谱与顶点采样的"X/Z 轴对齐 Bug"——诊断、根因、修复笔记

> 写给未来的自己：这个 bug 我和 Claude 一起兜了 **十几轮对话**才定位，期间 Claude 走了大量弯路（直到我用 wireframe 测试一刀切才确认）。把这次诊断完整记下来，警示三件事：
>
> 1. **看代码不等于读代码**——单独看每一段都"对称"，**跨文件对照约定才是关键**
> 2. **凭印象给建议会浪费大量时间**——必须先读 config / 读 shader 再回答
> 3. **wireframe 是 ocean rendering 调试的核武器**——一旦把着色这层壳剥掉，几何问题就藏不住了

---

## 一、症状（用我自己的话）

- 同一份 shader、同一份 config（C0 cascade active、C1/C2/C3 amplitude=0）、相机绕 Y 轴 orbit
- **0° / 180° 视角**：能看到清晰的"对撞波峰"——多方向波互相干涉、波峰陡峭
- **90° / 270° 视角**：变成"圆润鼓包"——像沙丘、没有波的感觉
- spreadBlend=0、swell=0（应该完全各向同性），仍然有 90° 周期的方向偏好
- **wireframe 模式下方向偏好依然存在**——所以不是着色 bug，是**几何 bug**

---

## 二、Claude 的弯路（我犯过的所有错误判断，记下作为反面案例）

### 弯路 ①：怀疑 spreadBlend / swell / peakEnhancement

Claude 第一反应是建议改方向扩散参数。当时 swell=1.9、peakEnhancement=8——确实偏极端。但**就算这俩参数压回正常，方向偏好仍然存在**，说明根因不在谱的参数。

**教训**：参数调整能改善画面，但**不能解释方向周期性**。各向同性谱的物理是"任意方向能量相同"——只要 spreadBlend=0，参数极端不极端都不该产生方向偏好。

### 弯路 ②：怀疑波长太长 / mesh 太小

Claude 算 `ωp = 22·(g²/(UF))^(1/3) = 0.88 rad/s → λ_peak ≈ 80m`，结论"256m mesh 只能容 3 个周期，所以看到几个大鼓包"。

实际：surfaceSize 改成 1024 后**鼓包问题仍然存在**——和 mesh 大小无关。波长长是个次要因素，不是根因。

**教训**：物理量纲计算能给上下文，但不能替代"实际跑一遍看效果"的验证。

### 弯路 ③：怀疑 C0 + C1 双 cascade 互相干涉

Claude 看到 spec0 windDir=0°、spec1 windDir=90°、两个 fetch 不同，怀疑两谱叠加产生方向偏好。

实际：**C1 amplitude=0 被关掉**，问题仍然存在。**只有 C0 单层 active 也有方向偏好**。

**教训**：Claude 看到 config 没看清"哪些 cascade 在 active"。**永远先读用户当前的真实参数，再分析。**

### 弯路 ④：怀疑 sun + camera 的着色几何

Claude 猜"k1（SSS 波峰透光项）只在逆光视角点亮，所以 0°/180° 看到对撞波峰、90°/270° 看不到"。让我跑 `vec4(vec3(pow(max(0, dot(L, -V)), 4.0)), 1.0)` 验证。

结果：0° 大面积白、其他三个角度全黑。**k1 确实是 0° 对撞波峰的成因之一**，但**改 sun 方向后 wireframe 鼓包仍存在**。

**教训**：着色 bug 和几何 bug 必须分离测试。**wireframe 模式是判决工具**——它能跑出"和着色完全无关"的画面，看到的方向偏好只能来自几何本身。

### 弯路 ⑤：声称"FFT 流水线完全各向同性"

Claude 把谱→h0→IFFT→assembly→vertex 全部读了一遍，逐步论证每一步"X 和 Z 对称"，得出结论"几何上应该完全各向同性"。

结果：**wireframe 模式下方向偏好真实存在**——Claude 的"对称分析"漏掉了一个跨文件的约定不一致。

**教训**：**单看每一步 X/Z 对称**，**不等于跨步骤组合后仍然对称**。如果"谱端 kx 绑定 tex.y"但"顶点端 worldXZ.x 绑定 tex.x"，**单看哪一头都没毛病，组合起来就是 90° 转置**。

---

## 三、真凶：CPU + GPU 用了同一套"非标准约定"，但 vertex shader 用的是"标准约定"

### 三方约定对比

| 文件                                               | 谁绑定 texture.x                                                          | 谁绑定 texture.y                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **CPU**：`InitialSpectrum-refactor.ts:44-45`       | `kz = waveNumber(m)`<br>m 是 col 循环 ↔ tex.x                            | `kx = waveNumber(n)`<br>n 是 row 循环 ↔ tex.y                            |
| **GPU 谱**：`realtimeSpectrum/fragment.frag:46-53` | `m = floor(vTexCoord.x * uN)`<br>`kz = TWO_PI * mIdx / uL`<br>kz ↔ tex.x | `n = floor(vTexCoord.y * uN)`<br>`kx = TWO_PI * nIdx / uL`<br>kx ↔ tex.y |
| **GPU 顶点**：`vertex-multi-layers.vert:59-62`     | `worldXZ.x = world.x`<br>uv.x = world.x → tex.x                           | `worldXZ.y = world.z`<br>uv.y = world.z → tex.y                           |

**CPU 和 GPU 谱**约定**一致**——它们都把 kx 绑到 tex.y、kz 绑到 tex.x。**这是非标准约定**（行业惯例是 kx ↔ tex.x），但因为两端协议一致，所以 spectrum 和 IFFT 内部跑得"正确"——h0、共轭、Hermitian 对称、时间演化、IFFT 蝶形全部按这套非标准约定自洽运行。

**问题出在 vertex shader**：它做的是最自然的"world.x 对应 tex.x"假设——这是**标准约定**。

### 错位的实际效果

经过 IFFT 后，texture 的空间映射是：

- texture X 轴（tex.x）= 与 kz 配对的 IFFT 轴 = **空间 z 方向**（因为 kz 是 z 方向的波数）
- texture Y 轴（tex.y）= 与 kx 配对的 IFFT 轴 = **空间 x 方向**

但 vertex shader 用 `worldXZ` 当 uv：

- `uv.x = world.x` 读取 tex.x → 读到"空间 z = world.x"的位移
- `uv.y = world.z` 读取 tex.y → 读到"空间 x = world.z"的位移

**也就是：在 world (X, Z) 顶点处，读到的是 spatial (Z, X) 的位移数据。等价于沿主对角线 x=z 做反射（transpose）。**

更糟的是，**displacement 通道 Dx 和 Dz 也参与了错配**：

- pack1.r = Dx_spectrum = `-i·(kx/|k|)·h` → IFFT 后 = 沿 spatial-x 方向的位移
- spatial-x = tex.y 方向 = world.x（在 transpose 之后）
- 所以 Dx 物理意义"应该"是 world.x 方向位移
- 但**顶点 shader 把它加到 vertex.x 上**——巧合的是这对了一半（如果 spatial-x 也叫 world.x 就完美，但已经被 transpose 了）

最终视觉：**Dx 应用在 world.x 方向，但 Dx 的空间分布被 transpose 了 90°**——这就是 wireframe 下看到的 90° 周期方向偏好的根源。

### 为什么是"沿对角线对称"

`transpose(x, z) = (z, x)` 的不动点是 x=z 这条主对角线。也就是说，沿 x=z 方向的波形**不受错位影响**；沿 x=−z 方向的波形**最受影响**（被反射）；沿 ±x 或 ±z 轴方向**部分受影响**。

camera 0°/180° 和 90°/270° 因为 orbit 视角不同，看到的"主轴对齐情况"不同，**视觉差异就出来了**。

---

## 四、修复方式

### 方式 A：workaround——在所有采样处加 `.yx`（一行也不动 spectrum 端）

**改 5 处**：

1. `vertex-multi-layers.vert:59-62`
   ```glsl
   vec3 d0 = texture2D(uDisplacementMap0, worldXZ.yx / uLayerSize0).xyz;
   vec3 d1 = texture2D(uDisplacementMap1, worldXZ.yx / uLayerSize1).xyz;
   vec3 d2 = texture2D(uDisplacementMap2, worldXZ.yx / uLayerSize2).xyz;
   vec3 d3 = texture2D(uDisplacementMap3, worldXZ.yx / uLayerSize3).xyz;
   ```

2-5. `fragment-multi-layers.frag` 4 处（slope/jacobian/varMask noise/foam）：所有 `vSampleWorldXZ` 和 `vWorldXZ` 后面都加 `.yx`

**优点**：minimal、不动谱端、可逆。
**缺点**：留下 5 个"为什么要 .yx？"的 magic 写法，未来调试时容易困惑。整个代码库仍然是"非标准约定"。

### 方式 B：清洁修法——把谱端约定改成标准（kx ↔ tex.x、kz ↔ tex.y）

**改 2 处**（CPU + GPU 各一处），**还原 5 处**（vertex 和 fragment 的 .yx）：

#### B-1：`src/simulation/ocean/fft/InitialSpectrum-refactor.ts` 第 44-45 行

```ts
// 物理含义：让 kx 绑定到 texture 的列方向（m），kz 绑定到行方向（n）
//   这样 IFFT 后 spatial-x 沿 texture X 轴（列），spatial-z 沿 texture Y 轴（行）
//   下游顶点 shader 用最自然的 uv = (world.x/L, world.z/L) 即可正确采样
const kx = this.waveNumber(m) // ← 原本是 waveNumber(n)，现在改成 m
const kz = this.waveNumber(n) // ← 原本是 waveNumber(m)，现在改成 n
```

#### B-2：`src/shaders/water/fftOcean/compute/realtimeSpectrum/fragment.frag` 第 52-53 行

```glsl
// 物理含义：kx 沿 texture X 轴（列方向 m），kz 沿 texture Y 轴（行方向 n）
//   标准 FFT-ocean 约定，与 InitialSpectrum.ts 保持一致
float kx = TWO_PI * mIdx / uL; // ← 原本是 nIdx，现在改成 mIdx
float kz = TWO_PI * nIdx / uL; // ← 原本是 mIdx，现在改成 nIdx
```

> 关键：**只改 kx/kz 的赋值**，**不改 `n = floor(vTexCoord.y * uN)` 和 `m = floor(vTexCoord.x * uN)` 这两行**——因为 ComplexBuffer 的内存布局是 `real[n * N + m]`（n 是 row、m 是 col），GPU 端 `n ↔ tex.y`、`m ↔ tex.x` 是和 CPU 内存布局一致的，必须保持不动。

#### B-3：`src/shaders/water/fftOcean/vertex-multi-layers.vert` 第 59-62 行还原

```glsl
vec3 d0 = texture2D(uDisplacementMap0, worldXZ / uLayerSize0).xyz;
vec3 d1 = texture2D(uDisplacementMap1, worldXZ / uLayerSize1).xyz;
vec3 d2 = texture2D(uDisplacementMap2, worldXZ / uLayerSize2).xyz;
vec3 d3 = texture2D(uDisplacementMap3, worldXZ / uLayerSize3).xyz;
```

#### B-4：`src/shaders/water/fftOcean/fragment-multi-layers.frag` 4 处还原

```glsl
// sampleLayerSlopeByLayerSize（第 256-260 行）
vec2 uv = vSampleWorldXZ / layerSize;

// sampleLayerJacobianByLayerSize（第 262-265 行）
vec2 uv = vSampleWorldXZ / layerSize;

// varMask noise（第 294 行）
float noiseRaw = texture2DLodEXT(uDisplacementMap0, vWorldXZ * 0.001 * uVarMaskTexScale, 0.0).y;

// calcFoamByLayerSize（第 561-565 行）
float foam =
  uLayerContribute0 * texture2D(uDisplacementMap0, vSampleWorldXZ / uLayerSize0).a +
  uLayerContribute1 * texture2D(uDisplacementMap1, vSampleWorldXZ / uLayerSize1).a +
  uLayerContribute2 * texture2D(uDisplacementMap2, vSampleWorldXZ / uLayerSize2).a +
  uLayerContribute3 * texture2D(uDisplacementMap3, vSampleWorldXZ / uLayerSize3).a;
```

### 推荐：B（清洁修法）

理由：

- 把代码库统一到行业标准约定（kx ↔ tex.x），未来 onboarding、debug、新功能都不会再被这套"非标准约定"绊倒
- 改动量很小：CPU 1 行、GPU 谱端 2 行，共 3 行 spectrum 端改动，外加 9 行还原（5 处 sample 还原），总改动量比 A 多 7 行
- 风险可控：仅交换 kx/kz 的索引来源，不改 FFT 算法、不改 packing、不改下游

### 验证清单

- **wireframe 模式 4 个相机角度**（0°/90°/180°/270°）都看到"对撞波峰"，没有"鼓包"
- **shaded 模式（开 SSS + spec）**：specular 闪烁在波峰、SSS 在波峰激活、foam 长在波峰
- **slope 单独输出 `gl_FragColor = vec4(surf.slope * 0.5 + 0.5, 0.0, 1.0)`**：波形纹路四个方向看分布均匀，没有 90° 偏置

---

## 五、约定速查表（修完之后的正确状态）

```
+-------------------+-------------------+-------------------+
|                   |   texture.x 轴    |   texture.y 轴    |
+-------------------+-------------------+-------------------+
| ComplexBuffer     |  m（列）          |  n（行）          |
+-------------------+-------------------+-------------------+
| Spectrum 端       |  kx（波数 X 分量）|  kz（波数 Z 分量）|
+-------------------+-------------------+-------------------+
| IFFT 后空域       |  spatial x        |  spatial z        |
+-------------------+-------------------+-------------------+
| Vertex shader     |  world.x          |  world.z          |
+-------------------+-------------------+-------------------+
```

整条链路一致：**世界 X = 谱 kx = 纹理 X = 列**、**世界 Z = 谱 kz = 纹理 Y = 行**。

---

## 六、教训（写给未来的自己）

### 1. 工程上：跨文件约定要写明、要 grep-able

这次的根因是"两个文件用了不同的隐含约定"。如果在 spectrum 端的 frag 文件顶部有这样一段注释：

```glsl
// ============================================================
// 轴约定 (与 InitialSpectrum.ts、vertex.vert、fragment.frag 全链路一致):
//   texture.x ↔ m (列) ↔ kx (波数 X 分量) ↔ world.x
//   texture.y ↔ n (行) ↔ kz (波数 Z 分量) ↔ world.z
// ============================================================
```

那任何后来人（包括未来的我）一看就知道这条约定，**不会写出 `worldXZ.yx` 这种 magic**。

→ **以后所有跨文件的轴约定 / 时间方向 / 单位约定，都要在每个相关文件的顶部明确写出**。

### 2. 调试上：先用最简的输出 isolate 各层

这次拖了十几轮，主要是因为前期一直在调"着色"。等用户上 wireframe 之后，问题立刻定位到几何层。

**优先用最简输出 isolate 问题层**：

- 怀疑 spec/shading：输出单个分量（e.g., `vec3(pow(L·-V, 4))`）
- 怀疑几何：wireframe
- 怀疑 spectrum：直接把 h0 texture 当颜色输出
- 怀疑 IFFT：把 pack0/pack1/pack2/pack3 当颜色输出

每一层的"中间量直接可视化"，是诊断 graphics bug 的硬技能。

### 3. 推理上：单步对称 ≠ 全局对称

Claude 之前说"每一步 X/Z 对称所以全局对称"——这是**逻辑跳跃**。**对称性必须以"端到端的约定"为前提**。两端约定不同时，再"对称的算法"都会产出不对称的视觉。

→ 写诊断时**必须问一句**："这两个文件的轴约定一致吗？"

### 4. 协作上：当 LLM 说"应该 / 必然 / 一定"时要警惕

Claude 这轮多次说"在 spreadBlend=0 下波场必然各向同性"——这是**根据它分析的代码逻辑推断的"应然"**，但**用户用 wireframe 给了"实然"反例**。

→ 凡是 LLM 说"必然"的结论，**优先用最简的实验验证一次**，不要直接接受推理结论。

---

## 七、相关文件路径（方便日后查找）

- `src/simulation/ocean/fft/InitialSpectrum-refactor.ts`：CPU 端 h0 生成
- `src/simulation/ocean/fft/ComplexBuffer.ts`：内存布局 `real[n * N + m]`
- `src/simulation/ocean/fft/RealtimeSpectrumGPU.ts`：h0 上传 GPU + 每帧调度
- `src/shaders/water/fftOcean/compute/realtimeSpectrum/fragment.frag`：时间演化 + packing
- `src/shaders/water/fftOcean/compute/fftStockham/FFTStockham2D.frag`：IFFT 蝶形（轴无关）
- `src/shaders/water/fftOcean/compute/packedAssembly/fragment.frag`：IFFT 解包 + choppiness
- `src/shaders/water/fftOcean/vertex-multi-layers.vert`：顶点位移采样
- `src/shaders/water/fftOcean/fragment-multi-layers.frag`：fragment 端 slope/jacobian/foam 采样
- `src/scenes/water/fftOcean/_config/fftOceanSceneConfig-MultiLayers.ts`：cascade 配置

---

## 八、后续可能踩的坑（已知未爆）

- **FFT 网格的轴向 quantization**：即使约定全部对齐，FFT 在 ±kx 和 ±kz 轴上的离散采样仍然是"格点对齐"，对角方向波长分布会比沿轴方向略疏。视觉上可能出现极轻微的"沿轴更密、对角更疏"。这不是 bug，是 FFT 离散本质。
- **`vTexCoord` 的 Y 方向翻转问题**：WebGL 的纹理 Y 轴方向取决于 `UNPACK_FLIP_Y_WEBGL`。本项目 `RealtimeSpectrumGPU.uploadComplexBufferAsTexture` 没设这个，所以默认 false（不翻转）。如果未来某个 cubemap loader 或纹理 utility 改了这个 flag 的默认值，可能影响 h0 的上传方向，进而引起轴翻转。**修改 UNPACK_FLIP_Y_WEBGL 的代码必须保存/恢复**。

---

**日期**：2026-05-23  
**修复人**：用户（Claude 协助诊断 + 走弯路）  
**核心定位手段**：wireframe + 4 视角对照截图
