import { MeshRenderer } from '@/renderers/MeshRenderer'
import { PerspectiveCamera } from 'three'
import { BaseRenderer } from './BaseRenderer'
import { FrameContext } from './types/FrameContext'
import { RenderPass } from './passes/types/RenderPass'
import { OverlayRenderPass } from './passes/overlay/OverlayRenderPass'

export class WebGLRenderer {
  public gl: WebGLRenderingContext
  public camera: PerspectiveCamera
  private startTime = Date.now()
  private lastTime = 0
  private frameCount = 0

  public lights: Map<string, MeshRenderer> = new Map()

  private renderPasses: RenderPass[] = []

  private overlayRenderPass: OverlayRenderPass

  constructor(gl: WebGLRenderingContext, camera: PerspectiveCamera) {
    this.gl = gl
    this.camera = camera
    // this.lightSystem = new LightSystem(gl)

    // this.overlayPass = new OverlayPass(this.lights, this.hudEntries)
    this.overlayRenderPass = new OverlayRenderPass()
  }
  // ============================================================
  //  Pass 管理
  // ============================================================
  addRenderPass(pass: RenderPass): void {
    this.renderPasses.push(pass)
  }

  removeRenderPass(name: string): void {
    const index = this.renderPasses.findIndex((pass) => pass.name === name)
    if (index > -1) {
      this.renderPasses[index]?.dispose()
      this.renderPasses.splice(index, 1)
    }
  }

  getRenderPass<T extends RenderPass>(name: string): T | null {
    return (this.renderPasses.find((pass) => pass.name === name) as T) ?? null
  }

  getOverlayRenderPass(): OverlayRenderPass {
    return this.overlayRenderPass
  }

  // ============================================================
  //  HUD 管理
  // ============================================================
  /**
   * 注册一个 HUD 渲染器
   *
   * HUD 渲染器不参与场景的 draw() 流程，
   * 而是在每帧最后调用 renderAsHUD()。
   *
   * @param renderer  渲染器实例（通常是 createAxisRenderer() 的返回值）
   * @param position  屏幕位置（归一化坐标，左下角为原点）
   * @param size      HUD 视口大小（像素）
   */
  addHUDRenderer(
    renderer: BaseRenderer,
    position: { x: number; y: number } = { x: 0.05, y: 0.05 },
    size: number = 120
  ): void {
    // this.hudEntries.push({ renderer, position, size })
    this.overlayRenderPass.addHUDEntry({ renderer, position, size })
  }

  render() {
    const gl = this.gl
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clearDepth(1.0)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    // ========== 构建完整的 FrameContext ==========
    const now = (Date.now() - this.startTime) / 1000
    const context: FrameContext = {
      elapsedTime: now,
      deltaTime: now - this.lastTime,
      frame: this.frameCount++,
      resolution: {
        width: gl.canvas.width,
        height: gl.canvas.height
      },
      mouse: { x: 0, y: 0, clickX: 0, clickY: 0, pressed: false }, // TODO: 接入鼠标事件
      textureUnitCounter: 0
    }
    this.lastTime = now

    // ========== 执行所有 pass（shadow, upscale, deferred 等） ==========
    for (const pass of this.renderPasses) {
      // pass.execute(this.meshRenderers, context, this.camera)
      // pass.execute(this.meshRenderers, context, this.camera)
      pass.execute(context, this.camera)
    }

    // ========== Pass Overlay: 替代原有的 Pass 4 & Pass 5 ==========
    // Pass 4: Draw light visualizers & Pass 5: HUD pass（最后渲染，覆盖在场景之上）
    // 永远最后执行，不需要场景注册
    this.overlayRenderPass.execute(context, this.camera)
  }

  clearRenderPasses(): void {
    console.log(111)
    console.log(this.renderPasses)

    for (const pass of this.renderPasses) {
      pass.dispose()
    }
    this.renderPasses = []
  }
}
