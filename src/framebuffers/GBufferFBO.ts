import { FBO } from './FBO'

/**
 * G-Buffer 帧缓冲
 *
 * 5 个 color attachment（MRT）：
 * - [0] Diffuse (Kd)
 * - [1] Depth (线性，gl_Position.w)
 * - [2] Normal (世界空间，含 normal map)
 * - [3] Shadow (可见性)
 * - [4] World Position
 *
 * 所有 attachment 使用 FLOAT 类型（需要 OES_texture_float 扩展）
 * 使用 NEAREST 过滤（G-Buffer 数据不应插值）
 */
export class GBufferFBO {
  private gl: WebGLRenderingContext

  private fbo: FBO

  private _width: number
  private _height: number

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
      colorAttachmentCount: 5,
      depthMode: 'renderbuffer',
      colorTextureConfig: {
        internalFormat: gl.RGBA,
        format: gl.RGBA,
        type: gl.FLOAT,
        minFilter: gl.NEAREST,
        magFilter: gl.NEAREST
      }
    })
  }

  get width(): number {
    return this._width
  }
  get height(): number {
    return this._height
  }

  /** 访问 G-Buffer 纹理 */
  get diffuseTexture(): WebGLTexture | null {
    return this.fbo.getTexture(0) ?? null
  }
  get depthTexture(): WebGLTexture | null {
    return this.fbo.getTexture(1) ?? null
  }
  get normalTexture(): WebGLTexture | null {
    return this.fbo.getTexture(2) ?? null
  }
  get shadowTexture(): WebGLTexture | null {
    return this.fbo.getTexture(3) ?? null
  }
  get positionTexture(): WebGLTexture | null {
    return this.fbo.getTexture(4) ?? null
  }

  getFBO(): FBO {
    return this.fbo
  }

  bind() {
    this.fbo.bind()
    this.gl.viewport(0, 0, this._width, this._height)
  }

  /**
   * 解绑 FBO 并恢复 viewport（屏幕尺寸）
   *
   * @param fullWidth 屏幕（canvas）宽度
   * @param fullHeight 屏幕（canvas）高度
   */
  unbind(fullWidth: number, fullHeight: number) {
    this.fbo.unbind()
    this.gl.viewport(0, 0, fullWidth, fullHeight)
  }

  resize(width: number, height: number): void {
    this._width = width
    this._height = height
    this.fbo.dispose()
    this.fbo = this.createFBO(width, height)
  }

  dispose(): void {
    this.fbo.dispose()
  }
}

// const gBufferFBO = new FBO(gl, {
//   width: canvas.width,
//   height: canvas.height,
//   colorAttachmentCount: 3,
//   depthMode: 'renderbuffer',
//   colorTextureConfig: {
//     type: gl.FLOAT // 位置/法线需要高精度
//   }
// })

// // 后处理（bloom）
// const bloomFBO = new FBO(gl, {
//   width: canvas.width / 2,
//   height: canvas.height / 2,
//   colorAttachmentCount: 1,
//   depthMode: 'renderbuffer',
//   colorTextureConfig: {
//     type: gl.FLOAT, // HDR
//     minFilter: gl.LINEAR, // bloom 需要平滑采样
//     magFilter: gl.LINEAR
//   }
// })
