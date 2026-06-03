import { TextureCreationError } from '@/errors/EngineError/TextureError/TextureCreationError'
import { CubemapFBOOptions } from './types/CubemapFBO'
import { TextureLoadError } from '@/errors/EngineError/TextureError/TextureLoadError'

export class CubemapFBO {
  private gl: WebGLRenderingContext
  private fbo: WebGLFramebuffer
  private rbo: WebGLRenderbuffer
  private cubemap: WebGLTexture | null

  private resolution: number
  private format: number
  private type: number
  // private generateMipmap: boolean

  constructor(gl: WebGLRenderingContext, options: CubemapFBOOptions) {
    this.gl = gl
    this.resolution = options.resolution
    this.format = options.format ?? gl.RGBA
    this.type = options.type ?? gl.FLOAT
    // this.generateMipmap = options.generateMipmap ?? true

    // 1. 创建空 CubeMap
    const cubemap = gl.createTexture()
    if (!cubemap) throw new TextureCreationError('TEXTURE_CUBE_MAP')
    this.cubemap = cubemap
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemap)
    for (let i = 0; i < 6; i++) {
      gl.texImage2D(
        gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
        0,
        this.format,
        this.resolution,
        this.resolution,
        0,
        this.format,
        this.type,
        null
      )
    }
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    // 2. FBO + RBO（深度缓冲）
    const fbo = gl.createFramebuffer()
    const rbo = gl.createRenderbuffer()
    this.fbo = fbo
    this.rbo = rbo
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.bindRenderbuffer(gl.RENDERBUFFER, rbo)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.resolution, this.resolution)
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbo)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  /** 把第 i 个面绑定为当前 color attachment 并切换 viewport */
  bindFace(index: number): void {
    const gl = this.gl

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_CUBE_MAP_POSITIVE_X + index,
      this.cubemap,
      0
    )
    gl.viewport(0, 0, this.resolution, this.resolution)
  }

  generateMipmap(): void {
    const gl = this.gl

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.cubemap)
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  }

  /**
   * 把 cubemap 所有权转移给调用方，调用方负责后续 deleteTexture。
   * 之后再调 dispose 不会删 cubemap，只删 FBO/RBO。
   */
  releaseCubemap(): WebGLTexture {
    if (!this.cubemap)
      throw new TextureLoadError('[CubemapFBO]', {
        reason: 'cubemap already released'
      })
    const tex = this.cubemap
    this.cubemap = null
    return tex
  }

  /** 释放所有 GL 资源（cubemap 也会被删，除非已 release） */
  dispose(): void {
    const gl = this.gl

    if (this.cubemap) gl.deleteTexture(this.cubemap)
    this.cubemap = null
    gl.deleteFramebuffer(this.fbo)
    gl.deleteRenderbuffer(this.rbo)
  }
}
