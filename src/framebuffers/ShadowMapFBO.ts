import { getCapabilities } from '@/_config/glCapabilities'
import { FBO } from '@/framebuffers/FBO'

/**
 * Shadow Map 专用 FBO。
 *
 * 底层复用通用 FBO（1 个 color attachment + depth renderbuffer），
 * 但语义上只关心深度信息：
 * - color attachment 存的是 pack 后的深度值（RGBA → float）
 * - depth renderbuffer 用于 depth test
 *
 * 为什么不直接用 depth texture？
 * WebGL 1 不保证支持 WEBGL_depth_texture 扩展，
 * 所以用 RGBA pack 是更通用的方案。
 */
export class ShadowMapFBO {
  private gl: WebGLRenderingContext
  private fbo: FBO

  readonly resolution: number
  /** 是否使用原生 depth texture */
  readonly useDepthTexture: boolean

  constructor(gl: WebGLRenderingContext, resolution: number) {
    this.gl = gl
    this.resolution = resolution
    // 检测扩展
    this.useDepthTexture = getCapabilities().depthTexture

    if (this.useDepthTexture) {
      // Depth texture 模式：
      // - 0 个 color attachment（shadow pass 只关心深度）
      // - depth 存在 texture 中，main pass 可采样
      this.fbo = new FBO(gl, {
        width: resolution,
        height: resolution,
        colorAttachmentCount: 0,
        depthMode: 'texture'
      })
    } else {
      // RGBA pack 模式：
      // - 1 个 color attachment（存 pack 后的深度值）
      // - depth 存在 renderbuffer 中（仅用于深度测试）
      this.fbo = new FBO(gl, {
        width: resolution,
        height: resolution,
        colorAttachmentCount: 1,
        depthMode: 'renderbuffer',
        colorTextureConfig: {
          type: gl.UNSIGNED_BYTE // 其余用默认（NEAREST + CLAMP_TO_EDGE）都合适
        }
      })
    }
  }

  bind(): void {
    const gl = this.gl
    this.fbo.bind()
    gl.viewport(0, 0, this.resolution, this.resolution)
  }

  /**
   * 解绑 FBO 并恢复 viewport（屏幕尺寸）
   *
   * @param fullWidth 屏幕（canvas）宽度
   * @param fullHeight 屏幕（canvas）高度
   */
  unbind(fullWidth: number, fullHeight: number): void {
    this.fbo.unbind()
    this.gl.viewport(0, 0, fullWidth, fullHeight)
  }

  /** 获取 framebuffer（用于 bindFramebuffer） */
  getFramebuffer(): WebGLFramebuffer | null {
    return this.fbo.getFrameBuffer()
  }

  /** 获取 shadow map 纹理（用于 main pass 采样） */
  getShadowMapTexture(): WebGLTexture | null {
    if (this.useDepthTexture) {
      return this.fbo.getDepthTexture()
    }
    return this.fbo.getTexture(0) ?? null
  }

  dispose(): void {
    this.fbo.dispose()
  }
}
