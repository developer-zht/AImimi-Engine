import { FrameContext } from '@/renderers/types/FrameContext'
import { PerspectiveCamera } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/**
 * 传递给 {@link Updatable.update} 的每帧上下文。
 *
 * 由 Engine 在 mainLoop 的 **update 阶段** 组装，聚合了所有
 * 帧级更新器可能需要触碰的"场景级可变状态"：
 *
 * - `context`  —— 本帧的 {@link FrameContext}（时间、帧序号、分辨率等），
 *                 由 FrameClock 在帧边界统一产出，update 与 render 两阶段共享。
 * - `camera`   —— 当前透视相机（perspective camera），更新器可读写其 position。
 * - `controls` —— 轨道控制器（OrbitControls）。注意其内部模型是
 *                 "相机绕 target 做球面运动"，手动改写 `camera.position`
 *                 后必须调用 `controls.update()`，否则会被它用旧的
 *                 球坐标偏移（spherical offset）覆盖回去。
 */
export interface UpdatableContext {
  context: FrameContext
  camera: PerspectiveCamera
  controls: OrbitControls
}

/**
 * 帧级更新器（per-frame updater）：在 **render 之前** 修改场景级状态，
 * 例如相机运镜、灯光动画、全局参数缓动等。
 *
 * 与 {@link RenderManager} 的区别（两者形状相同但作用域不同）：
 * - `RenderManager` 通过 `baseRenderer.addManager()` 挂在 **单个 BaseRenderer**
 *   上，生命周期与该 renderer 的 GPU 资源绑定，负责更新"这个物体自己"的数据
 *   （如 FFT 海洋频谱、粒子 VBO、骨骼矩阵）。
 * - `Updatable` 由 **Engine 直接驱动**，作用域是 **整个场景 / 帧**，
 *   负责更新不依附于任何 renderer 的全局对象（相机、全局 uniform 等）。
 *
 * 执行时机：Engine.mainLoop() 在 `FrameClock.tick()` 之后、
 * `renderer.render()` 之前，遍历所有 Updatable 调用其 `update()`。
 *
 * @example
 * ```ts
 * // 注册一个绕中心点环绕的相机运镜
 * engine.addUpdater(new CameraOrbitAnimator([0, 10, 0], 50, 20, 0.5))
 * ```
 *
 * @remarks
 * 仅当行为无法用 OrbitControls 内置配置表达时才需要 Updatable。
 * 像"匀速环绕"这类 OrbitControls 自带 `autoRotate` 就能做的效果，
 * 应在场景/相机初始化时设一次开关，而不是写成 Updatable。
 */
export interface Updatable {
  /** 唯一标识符，用于调试与去重 */
  readonly name: string

  /**
   * 每帧调用一次，在此读写 `ctx.camera` / `ctx.controls` 等场景状态。
   * @param ctx 本帧上下文，见 {@link UpdatableContext}
   */
  update(ctx: UpdatableContext): void

  /** 释放更新器持有的资源（如有）。Engine 在卸载场景时调用 */
  dispose?(): void
}
