# objects（场景物体）

引擎中所有"可被渲染的物体"的几何/数据表示层。**只负责持有几何数据 + Transform，不负责绘制**——绘制由 `src/renderers/` 完成。

---

## 模块职责

`objects/` 下的类回答"**这个物体有什么几何数据，放在世界哪里**"，即：

- 顶点属性（position、normal、uv、tangent、color 等）
- 索引（可选；无索引时用 drawArrays）
- VBO/IBO 生命周期管理（创建、绑定、清理）
- attribute location 缓存（避免每帧 `getAttribLocation`）
- Transform（平移/旋转/缩放，参与 model 矩阵）

它们**不知道**：

- 自己会被怎么画（TRIANGLES？LINES？POINTS？由 renderer 决定）
- 用什么 shader / material（同样由 renderer 决定）

这一抽象边界是历史经验：`Mesh.ts` 注释专门解释了为什么"是否要求 index count 能被 3 整除"的校验**不应放在 Mesh 内部**——`AxesMesh` 用 6 个 index 画 3 条线，恰好能被 3 整除但不是三角形。

---

## 顶点属性约定

所有 Mesh 子类的顶点属性命名遵循以下约定（与 shader 端 `attribute` 声明一一对应）：

```glsl
attribute vec3 aVertexPosition; // 位置
attribute vec3 aNormalPosition; // 法向量
attribute vec2 aTextureCoord; // UV
attribute vec4 aTangent; // 切线 (xyz: 切线方向, w: 副切线手性 ±1)
attribute vec3 aColor; // 顶点色
```

> 部分模块（如 PRT 球谐 mesh）会有额外属性（如 `aSHCoeffs0..N`），见对应子目录。

---

## 目录结构

```
src/objects/
├── Mesh.ts                 — 基类，几何数据 + VBO/IBO + Transform
├── AxesMesh.ts             — 坐标轴（HUD 用，3 条线）
├── CubemapMesh.ts          — 立方体贴图渲染用的单位立方体
├── FullScreenQuad.ts       — 全屏四边形（后处理、SSR、blit 用）
├── SkyboxMesh.ts           — 天空盒立方体（NDC 空间内表面）
├── WaterSurface.ts         — 水面网格（动态分辨率 grid）
├── prt/                    — PRT 球谐网格构建（嵌入 SH 系数为顶点属性）
├── types/                  — Mesh / AttributeData / IndexData 类型
└── utils/
    ├── Transform.ts        — 平移/旋转/缩放数据结构
    └── generateGridMeshData.ts — 网格数据生成（用于水面、地形）
```

---

## 核心类：`Mesh`

### 生命周期

```
constructor → createVBOs → cacheAttriLocations → bind → dispose
```

1. **constructor**：保存 `attributes` 与 `indexData`（自动选择 Uint8/16/32 索引类型），初始化 Transform、唯一 name（`${name}#${id}`）
2. **createVBOs**：把每个 attribute 数据上传到 GPU；**多个 attribute 共享同一 array 时只创建一个 VBO**（interleaved 数据）
3. **cacheAttriLocations(shader)**：查询 shader 中每个 attribute 的 location 并缓存；未找到时 warn
4. **bind(gl)**：每帧调用——绑定 VBO 并配置 `vertexAttribPointer`，绑定 IBO
5. **dispose**：释放 VBO/IBO；共享 VBO 只删一次（用 Set 去重）

### Model 矩阵

`getModelMatrix()` 通过 `mat4.fromRotationTranslationScale` 一次性构造，旋转部分用四元数（`quat.fromEuler` 从欧拉角转，**注意 fromEuler 接受角度不是弧度**）。

> 历史代码尝试过 X/Y/Z 三个独立四元数相乘的写法（见源码注释），等价但更绕，已废弃。

### 工厂方法

- `Mesh.cube(transform, gl)` — 单位立方体
- `Mesh.sphere(transform, gl)` — 单位球（8×16 细分）

---

## 子类设计要点

| 子类             | 几何来源               | drawMode       | 备注                                         |
| ---------------- | ---------------------- | -------------- | -------------------------------------------- |
| `AxesMesh`       | 硬编码 3 轴 6 个顶点   | LINES          | HUD 用，由 `BaseRenderer.renderAsHUD()` 渲染 |
| `CubemapMesh`    | `CubeGeometry`         | TRIANGLES      | 通常用作 IBL 预计算的视口几何                |
| `FullScreenQuad` | 屏幕 NDC 四边形        | TRIANGLE_STRIP | 不带 Transform（在 NDC 空间）                |
| `SkyboxMesh`     | 立方体内表面           | TRIANGLES      | shader 中 swizzle z 到 w 让深度 = 1          |
| `WaterSurface`   | `generateGridMeshData` | TRIANGLES      | 分辨率由场景配置决定                         |

---

## 投影/法线矩阵

- **Model 矩阵**：由 Mesh 提供（`getModelMatrix()`）
- **View 矩阵**：由相机提供，`mat4.invert(camera.matrixWorld)`
- **Projection 矩阵**：相机内置
- **Normal 矩阵**：`transpose(inverse(mat3(model)))`，将法线从模型空间转世界空间

这些矩阵由 `BaseRenderer.bindCameraParameters()` 统一计算并上传引擎级 uniform（见 `src/renderers/README.md`）。

---

## 相关模块

- `src/renderers/` — 使用这些 Mesh 进行实际绘制
- `src/geometry/` — 离线生成的几何数据（CubeGeometry、SphereGeometry）
- `src/materials/` — 材质（shader uniform 配置）
- `src/errors/EngineError/MeshError/` — Mesh 相关错误类型
