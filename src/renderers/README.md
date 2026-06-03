# renderers（渲染器与渲染管线）

引擎的"**怎么画**"层。把 `objects/`（几何数据）、`materials/`（uniform 配置）、`shaders/`（shader 程序）三者粘合起来，调用 WebGL 完成绘制。

---

## 模块职责

`renderers/` 下的类回答"**给定一个 Mesh + Material + Shader，如何把它画到指定 FBO 上**"，即：

- 引擎级 uniform（MVP、camera position、normal matrix）的计算与上传
- attribute 绑定（委托给 `Mesh.bind()`）、uniform 绑定（委托给 `Material.applyUniforms()`）
- drawMode 校验（TRIANGLES 必须 3 的倍数、LINES 必须 2 的倍数等）
- 阴影投射/接收标志（`castShadow` / `receiveShadow`）
- HUD 渲染模式（独立小视口 + 正交投影 + 禁用深度测试）
- 多 pass 编排（forward、shadow、deferred、ssr 等）

---

## 三层结构

```
WebGLRenderer        ← 顶层：整帧编排，遍历所有 BaseRenderer 调用相应 pass
   │
   ├─ Pass           ← 中层：每帧调用一次，封装一类渲染逻辑（阴影、GBuffer、SSR…）
   │    │
   │    └─ BaseRenderer  ← 底层：单个物体的"Mesh + Material + Shader 绑定 + draw call"
```

### 底层：`BaseRenderer`

抽象基类，封装单个物体的渲染逻辑：

| 字段                                   | 说明                                                 |
| -------------------------------------- | ---------------------------------------------------- |
| `mesh: Mesh`                           | 几何数据                                             |
| `material: Material`                   | uniform 配置（包括纹理）                             |
| `shader: Shader`                       | shader 程序                                          |
| `drawMode: GLenum`                     | `TRIANGLES` / `LINES` / `LINE_STRIP` 等              |
| `castShadow / receiveShadow`           | 阴影标志（被 shadow pass 用于筛选）                  |
| `managers: Map<string, RenderManager>` | 渲染前需运行的子管理器（如 FFT 海洋的 compute 步骤） |

#### draw 流程（8 步）

```
① managers.update(context)      ← 渲染前计算（如 GPU FFT 演化）
② fbo.bind() / 默认 framebuffer  ← 选择渲染目标
③ shader.use()                  ← 激活 shader 程序
④ mesh.bind(gl)                 ← 绑定 VBO/IBO，配置 attribute
⑤ bindCameraParameters(camera)  ← 上传引擎级 uniform (MVP、camera、normal)
⑥ material.applyUniforms()      ← 上传材质 uniform（含纹理绑定，textureUnit 内部累加）
⑦ drawElements / drawArrays     ← 根据是否有 index 选择
⑧ unbind framebuffer            ← 解绑
```

#### 引擎级 uniform 约定

`BaseRenderer.ENGINE_UNIFORMS` 定义了 5 个引擎统一管理的 uniform，shader 中保留这些名字即可自动获得对应数据：

```ts
'uModelMatrix' // mat4，Mesh.getModelMatrix()
'uViewMatrix' // mat4，inverse(camera.matrixWorld)
'uProjectionMatrix' // mat4，camera.projectionMatrix
'uCameraPos' // vec3，camera.position
'uNormalMatrix' // mat3，transpose(inverse(mat3(model)))
```

#### HUD 模式

`renderAsHUD(camera, context, hudPosition, hudSize)` 用于绘制屏幕固定位置的辅助物体（坐标轴指示器等）：

1. 保存当前 viewport
2. 设置小视口（左下角为 0,0；位置/尺寸为像素）
3. 禁用深度测试
4. 用正交投影 + **清零平移分量**的视图矩阵（只保留旋转）
5. 绘制
6. 恢复 viewport 与深度测试

### 中层：Pass

每帧调用一次的渲染阶段。每个 Pass 内部按需调用一组 `BaseRenderer.draw()`：

```
src/renderers/passes/
├── forward/       — 前向渲染主 pass
├── shadow/        — 阴影深度 pass（point / directional）
├── deferred/      — 延迟渲染 (GBuffer、Depth Mipmap、SSR)
├── fft/           — FFT 海洋 GPU 计算 pass（单层 / 多层 v1/v2/v3）
├── overlay/       — HUD/UI 覆盖层
├── lowResolution/ — 低分辨率渲染（性能优化）
└── types/         — RenderPass 接口
```

### 顶层：`WebGLRenderer`

主渲染器，每帧编排所有 pass。内部维护：

- 所有需要渲染的 `BaseRenderer` 集合
- 按 `castShadow` / `receiveShadow` 分组的子集
- pass 执行顺序（shadow → forward / deferred → overlay）

---

## Factories（渲染器工厂）

构造一个完整的 renderer 需要组装 mesh + material + shader + 必要纹理，过程繁琐。`factories/` 提供按场景类型预配置好的工厂：

```
src/renderers/factories/
├── axes/                       — 坐标轴 HUD 渲染器
├── meshRendererFromModel/      — 从 GLTF / OBJ 模型创建普通 mesh 渲染器
├── deferred/                   — 从 GLTF / OBJ 创建 GBuffer 渲染器
├── water/                      — 简单波 / FFT 海洋渲染器（单层 / 多层）
└── prt/                        — PRT 球谐渲染器
```

每个工厂函数都返回 `BaseRenderer` 的子类实例。

---

## 调试命名规则

为方便调试（识别 GPU 调用栈中的对象），所有 Mesh / Material / Renderer 实例名遵循以下模板：

```
ctx = '[function name]'            // 例如 createGBufferRendererFromOBJ
rendererName = 'renderer name'     // 例如 ShadowMeshRenderer

Mesh           : `${ctx} ${rendererName}<Mesh>`
GBufferMaterial: `${ctx} GBufferMaterial<${rendererName}>`
MeshRenderer   : `${ctx} MeshRenderer<${rendererName}>`
```

加上 `BaseRenderer.idCount` 自增 id，保证全局唯一：

```
[createGBufferRendererFromOBJ] ShadowMeshRenderer<Mesh>#42
```

---

## 阴影流程速览

1. 每个 renderer 有 `castShadow` 和 `receiveShadow` 两个布尔
2. `WebGLRenderer` 在构造时按这两个标志把 renderer 加入对应集合
3. **shadow pass** 只画 `castShadow = true` 的 renderer，输出 shadow map
4. **forward pass** 把 shadow map 作为纹理传给 `receiveShadow = true` 的 renderer
5. 用户运行时切换 `castShadow` 时，`onShadowFlagChanged` 回调通知 `WebGLRenderer` 更新分组

---

## 常见陷阱

### textureUnit 不能跨 renderer 累加

`Material.applyUniforms()` 内部维护纹理单元计数，**每个 renderer 独立从 0 开始**。如果在 `WebGLRenderer` 中传递累加值，会导致后绑定的 renderer 把纹理放到不必要的高单元号（部分硬件最多 16/32 个）：

```ts
// 错误（已废弃）：
context.textureUnitCounter = this.material.applyUniforms(
  gl,
  this.shader,
  context.textureUnitCounter
)

// 正确：每个 renderer 内部从 0 开始
this.material.applyUniforms(gl, this.shader, 0)
```

### drawMode 与 index 数量的关系

`BaseRenderer.validateIndexCount()` 在构造时校验：

| drawMode                                 | 约束                  |
| ---------------------------------------- | --------------------- |
| `TRIANGLES`                              | count 必须能被 3 整除 |
| `LINES`                                  | count 必须能被 2 整除 |
| `LINE_STRIP` / `LINE_LOOP`               | count ≥ 2             |
| 其他 (`TRIANGLE_STRIP` / `TRIANGLE_FAN`) | 暂不校验              |

---

## 相关模块

- `src/objects/` — Mesh 几何数据来源
- `src/materials/` — 材质（uniform 配置）
- `src/shaders/` — Shader 程序
- `src/framebuffers/` — FBO（pass 的渲染目标）
- `src/managers/` — RenderManager（renderer 附加的子管理器，如 FFT compute）
