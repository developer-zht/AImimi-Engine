# Shaders

本目录存放所有 GLSL 着色器源代码（shader source code）以及 TypeScript 端的 Shader 抽象类。

## 一、Shader 类（src/shaders/Shader.ts）

`Shader` 是 GPU 程序对象的轻量封装，负责：

- 编译 vertex shader + fragment shader → 链接为 `WebGLProgram`
- 缓存 attribute / uniform 的 location，避免每帧重复查询
- 提供调试名（用于错误信息追踪具体哪个 shader 出问题）

**典型用法**（由 `BaseRenderer` 调用）：

```ts
const shader = new Shader(gl, vertSrc, fragSrc, 'MyShaderName')
shader.use()
shader.getAttribLocation('aPosition')
shader.getUniformLocation('uModelMatrix')
shader.dispose()
```

`Shader` 不知道 mesh / material / FBO 是什么——它只是一个 GPU program 的语义化封装。绑定数据的工作由 `Mesh.bind()` 和 `Material.applyUniforms()` 完成。

## 二、目录结构（按渲染功能分类）

```
shaders/
├── Shader.ts                 ← Shader 类实现
├── _config/                  ← shader 路径常量（按文件系统查找）
├── types/                    ← Shader 类型定义
│
├── deferred/                 ← 延迟渲染管线
│   ├── gbuffer/              ← G-Buffer 写入（albedo / normal / depth / 材质参数）
│   ├── sceneDepth/           ← 单独的场景深度通道
│   └── ssr/                  ← 屏幕空间反射 (Screen-Space Reflections)
│
├── environment/              ← 环境光照与天空背景
│   ├── cubemapBackground/    ← 立方体贴图背景（cubemap background）
│   ├── skybox/               ← 天空盒（skybox）
│   ├── converters/           ← 贴图格式转换
│   │   ├── linearize/        ← sRGB → linear 颜色空间
│   │   └── equirectToCubemap/← 等距柱状投影 (equirectangular) → 立方体贴图
│   └── IBL/                  ← 基于图像的光照预计算 (Image-Based Lighting)
│       ├── brdfLUT/          ← BRDF 查找表生成
│       ├── irradiance/       ← 辐照度卷积（漫反射 IBL）
│       └── prefilter/        ← 镜面预滤波（粗糙度分级 mipmap）
│
├── gizmo/                    ← 调试辅助物（debug helper）
│   ├── axis/                 ← 坐标轴
│   └── lightGizmo/           ← 光源位置指示器
│
├── lighting/                 ← 光照计算
│   ├── directLight/          ← 直接光（Blinn-Phong 等简单模型）
│   ├── shadow/               ← 阴影计算
│   │   ├── directional/      ← 方向光阴影（RGBA 打包 + 浮点深度纹理两版）
│   │   └── point/            ← 点光源全方位阴影（cube shadow map）
│   └── pbr/                  ← 基于物理的渲染 (Physically-Based Rendering)
│       ├── Cook-Torrance/    ← 经典微表面 BRDF
│       └── Kulla-Conty/      ← 多次散射能量补偿
│
├── postprocess/              ← 后处理（post-processing）
│   └── blit/                 ← 全屏拷贝（render target → screen / FBO → FBO）
│
├── prt/                      ← 预计算辐射传输 (Precomputed Radiance Transfer)
│   └── sphericalHarmonics/   ← 球谐光照
│       ├── order2/           ← 2 阶球谐（4 系数）
│       └── order3/           ← 3 阶球谐（9 系数）
│
├── shadertoy/                ← Shadertoy 风格的程序化着色实验
│   └── lerrain/              ← 作者 lerrain 的作品移植
│       └── cloudsOverSeaAndPeaks/  ← 云海与山峰
│
└── water/                    ← 水面相关
    ├── simpleWaves/          ← 解析式 GPU 波形（无需 CPU 配合）
    │   ├── sineWave/         ← 正弦波叠加
    │   └── gerstnerWave/     ← Gerstner 波（顶点位移）
    └── fftOcean/             ← FFT 海洋（频谱 + IFFT 数值波形）
        ├── vertex.vert       ← 单层主渲染 vertex
        ├── fragment.frag     ← 单层主渲染 fragment
        ├── vertex-multi-layers.vert
        ├── fragment-multi-layers.frag
        ├── compute/          ← GPU 计算着色器
        │   ├── realtimeSpectrum/    ← 时间演化的实时频谱
        │   ├── fftStockham/         ← Stockham 自动排序 FFT（1D + 2D）
        │   ├── fftButterflyShader/  ← Cooley-Tukey 蝶形 FFT（备选实现）
        │   └── packedAssembly/      ← IFFT 解包 + choppiness
        └── backup/           ← 历史版本备份（参考用，未启用）
```

## 三、引擎注入的标准 attribute / uniform / varying 约定

下面这些命名是 **`BaseRenderer` 与 shader 之间的隐式契约**——所有 shader 都可以假设这些名字可用。Shader 不需要也不应该重命名。

### 顶点 attribute（由 Mesh 提供）

```glsl
attribute vec3 aVertexPosition; // 物体局部空间位置 (object-space position)
attribute vec3 aNormalPosition; // 物体局部空间法线 (object-space normal)
attribute vec2 aTextureCoord; // UV 纹理坐标 [0, 1]
attribute vec4 aTangent; // 切线 + 副切线方向位 (xyz = tangent, w = bitangent sign ±1)
attribute vec3 aColor; // 顶点颜色（用于 axis / debug）
```

不是所有 mesh 都提供所有 attribute。`Mesh.cacheAttriLocations(shader)` 会查找 shader 真正需要的 attribute，缺失时静默忽略（用 console.warn）。

### 引擎级 uniform（由 BaseRenderer 每帧绑定）

```glsl
uniform mat4 uModelMatrix; // 物体 → 世界空间
uniform mat4 uViewMatrix; // 世界 → 相机空间
uniform mat4 uProjectionMatrix; // 相机 → 裁剪空间
uniform mat3 uNormalMatrix; // 物体法线 → 世界法线（inverse-transpose 后取 3x3）
uniform vec3 uCameraPos; // 相机世界空间位置
```

阴影相关（可选，由 Material 或 Manager 注入）：

```glsl
uniform mat4 uLightVP; // 光源 View × Projection（用于 shadow map 采样）
uniform sampler2D uShadowMap; // 阴影深度图
```

### 推荐的 varying 命名

```glsl
varying highp vec3 vWorldPos; // 顶点世界空间位置
varying highp vec3 vNormalWorld; // 顶点世界空间法线
varying highp vec2 vTexCoord; // 顶点 UV
varying highp vec4 vTangent; // 顶点切线（必要时带 bitangent sign）
```

### Shadertoy 兼容 uniform（仅 shadertoy/ 子目录使用）

```glsl
uniform vec3 iResolution; // 视口分辨率（像素）
uniform float iTime; // 着色器播放时间（秒）
uniform vec4 iMouse; // 鼠标坐标（xy: current, zw: click）
```

## 四、跨文件约定（必读）

### Vertex / Fragment 文件配对

每个 shader 通常由 vertex + fragment 一对文件组成，命名相同、扩展名区分：

```
foo/
├── vertex.vert
└── fragment.frag
```

加载时由 `loadShader` 拼接路径并读入 `Shader` 类。

### `.glsl` vs `.vert` / `.frag`

- 老代码用 `.glsl`（不区分阶段）
- 新代码使用 `.vert` / `.frag`（编辑器和 LSP 能识别阶段，提供更准确的语法高亮）

新增 shader 一律用 `.vert` / `.frag`。

### Shader 编号 / 调试名

`Shader` 构造时第 4 个参数 `name` 用于调试，最终格式为 `${name}#${id}`，与 `BaseRenderer.name` 配合追踪具体哪个 shader 在报错。

约定：

```
ctx       = '[function name]'  e.g. '[createGBufferRendererFromOBJ]'
rendererName = 'renderer name' e.g. 'ShadowMeshRenderer'

Shader name 模式：${ctx} <stage>Shader<${rendererName}>
  例：[createGBufferRendererFromOBJ] GBufferShader<ShadowMeshRenderer>
```

参考 `src/renderers/README.md` 的同套命名约定。

## 五、新增 shader 的 checklist

1. **选目录**：参考"目录结构"小节，按渲染功能落位
2. **命名**：`vertex.vert` + `fragment.frag`，必要时加版本后缀（如 `vertex-multi-layers.vert`）
3. **使用引擎注入的标准名**：不要自创 `uMVP` / `aPos` 这种缩写，统一用 `uProjectionMatrix` / `aVertexPosition`
4. **路径注册**：在 `src/shaders/_config/shaderPaths.ts` 添加常量
5. **在工厂/Manager 中加载并构造 Shader 实例**

## 六、相关模块

- `src/renderers/` — Renderer 和 RenderPass，调用 Shader 完成绘制
- `src/materials/` — Material 持有 uniform 数据，配合 Shader 推送到 GPU
- `src/objects/` — Mesh 提供 attribute 数据，配合 Shader 决定 attribute layout
- `src/framebuffers/` — FBO 决定 shader 写到哪个 render target
