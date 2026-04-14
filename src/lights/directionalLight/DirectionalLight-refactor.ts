import { Vec3 } from '@/math/types/math'
import { mat4, vec3 } from 'gl-matrix'
import { IDirectionalLight } from './types/directionalLight'
import { DirectionalLightParams } from './types/DirectionalLightParams'
import { ShadowConfig } from '@/renderers/passes/shadow/types/shadow'
import { DEFAULT_SHADOW_CONFIG } from '@/renderers/passes/shadow/_config/defaultConfig'

/**
 * 表示一个**方向光（Directional Light）**
 *
 * 👉 特点：
 * - 光源具有固定方向（direction），但没有衰减（类似太阳光）
 * - 所有光线平行
 * - 常用于模拟太阳光 / 室外光照
 *
 * 👉 渲染中的作用：
 * - 用于计算直接光照（direct lighting）
 * - 可用于生成阴影贴图（shadow map）
 *
 * ---
 *
 * @example
 * const light = new DirectionalLight(
 *   [10, 10, 10],   // radiance（光强）
 *   [0, 100, 0],   // position（用于构建 light view matrix）
 *   [0, -1, 0],    // direction（光照方向）
 *   [1, 0, 0],     // up 向量（用于 lookAt）
 *   { castShadow: true, shadowConfig: { orthoSize: 200 } }
 * )
 */
export class DirectionalLight implements IDirectionalLight {
  // ============================================================
  //  不可变属性（创建后不变）
  // ============================================================

  /** 光源类型标识，用于 switch 判别 */
  readonly type = 'directional' as const

  /** 是否投射阴影 */
  public readonly castShadow: boolean

  /**
   * 阴影贴图分辨率
   *
   * 常见值：1024 / 2048 / 4096
   * 值越大阴影越清晰，但 GPU 开销越大
   */
  public readonly shadowResolution: number

  /** 世界坐标系下的光源物理大小，PCSS 用。默认 5.0 */
  private _worldSize: number

  // ============================================================
  //  可变属性（GUI / 每帧可修改）
  // ============================================================

  /**
   * 光源辐射亮度（Radiance）
   *
   * 👉 物理含义：
   * - 单位：W·sr⁻¹·m⁻²
   * - 表示单位立体角、单位面积上的能量
   *
   * 👉 在 PBR 中：
   * - 通常作为 BRDF 输入的 Li
   */
  public radiance: Vec3

  /**
   * 光源位置
   *
   * 对方向光没有物理意义（无限远），但用于：
   * - 构建 shadow map 的 view matrix（lookAt 的 eye 参数）
   * - GUI 控制光照角度（配合 target 使用）
   */
  private _position: Vec3

  /**
   * 光照目标点
   *
   * lookAt 的 center 参数。direction 由 normalize(target - position) 自动计算。
   * 改 position 或 target 后，direction getter 自动返回新值。
   */
  private _target: Vec3

  /**
   * 光源的 up 向量（用于构建 view matrix）
   *
   * 👉 用于：
   * - mat4.lookAt 的第三个参数
   */
  public up: Vec3

  // ============================================================
  //  私有属性（外部不可访问）
  // ============================================================

  /**
   * 阴影配置（正交投影参数等）
   */
  private _shadowConfig: ShadowConfig

  /**
   * 创建一个方向光
   *
   * @param radiance 光源辐射亮度（RGB）
   * @param position 光源位置（用于构建 view matrix）
   * @param direction 光照方向（单位向量）
   * @param lightUp up 向量（用于 lookAt）
   * @param shadowOptions 阴影相关配置
   */
  constructor(params: DirectionalLightParams) {
    this.radiance = params.radiance
    this._position = params.position
    this.up = params.up ?? [0, 1, 0]
    this._worldSize = params.worldSize ?? 5.0

    // target / direction 二选一
    if ('target' in params && params.target !== undefined) {
      // target 模式：存 target，direction 由 getter 派生
      this._target = params.target
    } else {
      // direction 模式：由 direction 反推 target = position + direction
      const dir = params.direction
      this._target = [
        this._position[0] + dir[0],
        this._position[1] + dir[1],
        this._position[2] + dir[2]
      ]
    }

    // shadow
    this.castShadow = params.shadowOptions?.castShadow ?? true
    this.shadowResolution = params.shadowOptions?.shadowResolution ?? 2048
    this._shadowConfig = { ...DEFAULT_SHADOW_CONFIG, ...params.shadowOptions?.shadowConfig }
  }

  // ============================================================
  //  派生属性
  // ============================================================

  /**
   * 光照方向（light travel direction：light → scene）
   *
   * 👉 约定：
   * - 表示“光线前进方向”（从光源指向场景）
   * - 通常需要归一化
   *
   * 由 normalize(target - position) 自动计算。
   * 每次访问都重新计算，因此修改 position 或 target 后无需手动同步。
   */
  get direction(): Vec3 {
    const dir = vec3.create()
    vec3.subtract(dir, this._target, this._position)
    vec3.normalize(dir, dir)
    return [dir[0], dir[1], dir[2]]
  }

  /**
   * 着色方向（从 shading point 指向光源）
   *
   * 👉 为什么要取反？
   * - 当前 direction 表示“光传播方向”（light → scene）
   * - 而 BRDF 中需要的是：
   *   👉 wi（incoming light direction）= point → light
   *
   * 👉 即：
   * wi = -light.direction
   *
   * @returns 归一化方向向量（建议调用方保证）
   */
  get shadingDirection(): Vec3 {
    const d = this.direction
    return [-d[0], -d[1], -d[2]]
  }

  /**
   * 光源位置
   */
  get position() {
    return this._position
  }
  // direction 自动更新（因为是 getter）
  set position(pos: Vec3) {
    this._position = pos
  }

  /**
   * 光源大小
   */
  get worldSize() {
    return this._worldSize
  }

  set worldSize(value: number) {
    this._worldSize = value
  }

  /**
   * 光照目标点
   */
  get target() {
    return this._target
  }
  // direction 自动更新
  set target(t: Vec3) {
    this._target = t
  }

  /**
   * 阴影配置
   */
  get shadowConfig() {
    return this._shadowConfig
  }

  // ============================================================
  //  Shadow Mapping
  // ============================================================

  /**
   * 计算光源的 ViewProjection 矩阵（Light Space Matrix）
   *
   * 👉 用于：
   * - Shadow Mapping
   * - 将 world position 转换到 light space
   *
   * ---
   *
   * 计算流程：
   *
   * 1️⃣ View Matrix（光源视角）
   *   lookAt(lightPos, lightPos + direction, up)
   *
   * 2️⃣ Projection Matrix（正交投影）
   *   ortho(-s, s, -s, s, near, far)
   *
   * 3️⃣ VP = Projection × View
   *
   * ---
   *
   * 👉 为什么用正交投影？
   * - 方向光没有透视效果（平行光）
   *
   * @returns mat4 光源 VP 矩阵
   */
  getViewProjectionMatrix(): mat4 {
    const view = mat4.create()
    const proj = mat4.create()
    const vp = mat4.create()

    const focalPoint: Vec3 = this._target

    mat4.lookAt(view, this._position, focalPoint, this.up)

    const s = this.shadowConfig.orthoSize
    mat4.ortho(proj, -s, s, -s, s, this.shadowConfig.near, this.shadowConfig.far)

    mat4.multiply(vp, proj, view)

    return vp
  }
}

// // 海洋场景：覆盖范围要大
// const oceanLight = new DirectionalLight({
//   radiance: [10, 10, 10],
//   position: [1, 500, 0],
//   direction: { x: 0.39, y: -0.9, z: 0.2 },
//   up: [1, 0, 0],
//   shadow: { orthoSize: 200, near: 0.1, far: 1500 }
// })

// // 室内场景：覆盖范围小但精度高
// const roomLight = new DirectionalLight({
//   // ...
//   shadow: { orthoSize: 5, near: 0.01, far: 50 }
// })
