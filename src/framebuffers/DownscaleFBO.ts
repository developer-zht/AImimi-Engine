import { FBO } from './FBO'

/**
 * 降采样帧缓冲（Downscaled Framebuffer）
 *
 * @remark 用于：
 * - 后处理（Bloom / Blur / SSAO 等）
 * - 降低分辨率以减少像素计算开销
 *
 * @remark 特点：
 * - 内部使用浮点纹理（HDR）
 * - 支持按比例 resize（动态分辨率）
 *
 * @example 常见用法：
 * - 先 bind 到低分辨率 FBO 渲染
 * - 再采样该 texture 进行后处理
 */
export class DownscaleFBO {
  private gl: WebGLRenderingContext

  /** 内部帧缓冲对象 */
  private fbo: FBO

  /** 当前宽度（降采样后） */
  private _width: number
  /** 当前高度（降采样后） */
  private _height: number

  /**
   * @param gl WebGL 上下文
   * @param width 初始宽度
   * @param height 初始高度
   */
  constructor(gl: WebGLRenderingContext, width: number, height: number) {
    this.gl = gl
    this._width = width
    this._height = height

    this.fbo = this.createFBO(width, height)
  }

  private createFBO(width: number, height: number): FBO {
    const gl = this.gl
    return new FBO(gl, {
      width,
      height,
      colorAttachmentCount: 1,
      depthMode: 'renderbuffer',
      colorTextureConfig: {
        internalFormat: gl.RGBA,
        format: gl.RGBA,
        type: gl.FLOAT,
        // 缩放时双线性插值
        minFilter: gl.LINEAR,
        magFilter: gl.LINEAR
      }
    })
  }

  /**
   * 窗口 resize 时按比例重建
   *
   * @param fullWidth 屏幕（canvas）的实际宽度
   * @param fullHeight 屏幕（canvas）的实际高度
   * @param scale 降采样比例，范围 (0, 1]
   *
   * @remark
   * - 使用 floor 避免非整数尺寸导致 WebGL 报错
   * - scale 不建议低于 0.25，否则会明显模糊
   *
   * @example
   * fullWidth = 1920, fullHeight = 1080, scale = 0.25
   *
   * DownscaleFBO 实际尺寸:
   * _width  = floor(1920 × 0.25) = 480
   * _height = floor(1080 × 0.25) = 270
   *
   * 渲染像素数: 480 × 270 = 129,600（是原来 1920×1080 的 1/16）
   */
  resize(fullWidth: number, fullHeight: number, scale: number) {
    this._width = Math.max(1, Math.floor(fullWidth * scale))
    this._height = Math.max(1, Math.floor(fullHeight * scale))
    this.fbo.dispose()
    this.fbo = this.createFBO(this._width, this._height)
  }

  /**
   * 获取颜色纹理（
   *
   * @example
   * 用于后处理采样，比如 blit pass 采样
   */
  getColorTexture(): WebGLTexture | null {
    return this.fbo.getTexture(0) ?? null
  }

  /**
   * 获取内部 FBO
   */
  getFBO(): FBO {
    return this.fbo
  }

  // ==================== bind & unbind ====================
  /**
   * 绑定 FBO 并设置 viewport（降采样尺寸）
   */
  bind(): void {
    this.fbo.bind()
    this.gl.viewport(0, 0, this._width, this._height)
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

  // ==================== getter ====================
  /** 当前宽度 */
  get width(): number {
    return this._width
  }

  /** 当前高度 */
  get height(): number {
    return this._height
  }

  // ==================== dispose ====================
  /**
   * 释放 GPU 资源
   */
  dispose(): void {
    this.fbo.dispose()
  }
}
