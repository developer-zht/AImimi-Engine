import { FrameContext } from './types/FrameContext'

/**
 * 帧时钟：唯一负责构建 FrameContext
 * 把原本散落在 WebGLRenderer 里的 startTime/lastTime/frameCount 收拢到这里。
 */
export class FrameClock {
  private gl: WebGLRenderingContext

  private frameContext: FrameContext

  private startTime = Date.now()
  private lastTime = 0
  private frameCount = 0

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl

    this.frameContext = {
      elapsedTime: 0,
      deltaTime: 0,
      frame: 0,
      resolution: {
        width: gl.canvas.width,
        height: gl.canvas.height
      },
      mouse: { x: 0, y: 0, clickX: 0, clickY: 0, pressed: false }, // 将来接 InputManager
      textureUnitCounter: 0 // 每帧重置；render 阶段会原地递增
    }
  }

  /** 每帧在 mainLoop 顶部调用一次，产出本帧的 context */
  tick(): FrameContext {
    const now = (Date.now() - this.startTime) / 1000
    const deltaTime = now - this.lastTime
    this.lastTime = now

    const gl = this.gl
    const ctx = this.frameContext

    // ----- 必须逐帧刷新的字段 -----
    ctx.elapsedTime = now
    ctx.deltaTime = deltaTime
    ctx.frame = this.frameCount++
    ctx.resolution.width = gl.canvas.width // resize 时会变
    ctx.resolution.height = gl.canvas.height
    ctx.textureUnitCounter = 0 // render 阶段会递增，每帧归零

    return ctx
  }
}
