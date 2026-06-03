import { Vec3 } from '@/math/types/math'
import { Updatable, UpdatableContext } from './types/Updatable'

/**
 * 相机环绕动画器（orbit animator）。
 *
 * 让相机沿一个 **水平圆周（XZ 平面）** 匀速环绕一个固定中心点，
 * 并始终注视该中心。视觉上即"绕着目标飞一圈"。
 *
 * ## 运动模型
 * 相机位置由圆的参数方程（parametric circle）给出，角度随时间线性增长：
 *
 * ```
 * θ(t) = elapsedTime · angularSpeed          // 当前角度（弧度）
 * x(t) = center.x + radius · cos(θ)           // XZ 平面上画圆
 * z(t) = center.z + radius · sin(θ)
 * y(t) = center.y + offsetHeight              // 高度恒定，决定俯视角
 * ```
 *
 * - 单位：θ 为弧度（radian），`radius` / `offsetHeight` 与场景同为世界单位（world unit）。
 * - 角速度（angular speed）单位为 弧度/秒，转一整圈耗时 `2π / angularSpeed` 秒。
 * - 这是 **环绕（orbit）** 而非"原地转头（pivot）"：相机位置在动，target 固定。
 *   恰好契合 OrbitControls 的内部模型，故可放心调用 `controls.update()`。
 *
 * @example
 * ```ts
 * // 绕 (0,10,0) 半径 50、抬高 20、每秒 0.5 弧度环绕
 * engine.addUpdater(new CameraOrbitAnimator([0, 10, 0], 50, 20, 0.5))
 * ```
 */
export class CameraOrbitAnimator implements Updatable {
  public readonly name = 'CameraOrbitAnimator'

  /** 角速度（angular speed），单位 弧度/秒；转一圈耗时 2π / angularSpeed 秒 */
  private angularSpeed: number
  /** 环绕中心点 [x, y, z]（世界坐标），相机始终注视此点 */
  private center: Vec3
  /** 环绕半径（世界单位），即相机到中心在 XZ 平面上的水平距离 */
  private radius: number
  /** 相对 center 在 Y 方向的高度偏移；正值俯视、负值仰视、0 为平视 */
  private offsetHeight: number

  /**
   * @param center       环绕中心点 [x, y, z]（世界坐标）
   * @param radius       环绕半径（世界单位）
   * @param offsetHeight Y 方向高度偏移（相对 center），控制俯仰
   * @param angularSpeed 角速度（弧度/秒），正值逆时针、负值顺时针
   */
  constructor(center: Vec3, radius: number, offsetHeight: number, angularSpeed: number) {
    this.center = center
    this.radius = radius
    this.offsetHeight = offsetHeight
    this.angularSpeed = angularSpeed
  }

  /**
   * 每帧根据累计时间计算相机新位置并写入。
   *
   * 用 `context.elapsedTime`（自启动累计秒数）而非 `deltaTime` 累加，
   * 可避免浮点误差逐帧累积，角度始终是时间的纯函数（确定性、可复现）。
   *
   * @param ctx 本帧上下文（提供 elapsedTime、camera、controls）
   */
  update(ctx: UpdatableContext): void {
    const { frameContext, camera, controls } = ctx

    // 当前角度 = 累计时间 × 角速度（弧度）
    const angle = frameContext.elapsedTime * this.angularSpeed

    // --- camera position ----
    // 圆的参数方程：在 XZ 平面绕 center 画圆，Y 恒定
    const positionX = this.center[0] + this.radius * Math.cos(angle)
    const positionZ = this.center[2] + this.radius * Math.sin(angle)
    const positionY = this.center[1] + this.offsetHeight

    camera.position.set(positionX, positionY, positionZ)
    controls.target.set(...this.center)

    // 手动改写 camera.position 后必须 update()，
    // 否则 OrbitControls 会用其内部球坐标偏移把相机覆盖回去
    controls.update()
  }
}
