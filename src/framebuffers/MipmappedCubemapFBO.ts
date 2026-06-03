import { TextureCreationError } from '@/errors/EngineError/TextureError/TextureCreationError'
import { TextureLoadError } from '@/errors/EngineError/TextureError/TextureLoadError'
import { MipmappedCubemapFBOOptions } from './types/MipmappedCubemapFBO'

export class MipmappedCubemapFBO {
  private gl: WebGLRenderingContext
  private fbo: WebGLFramebuffer

  private cubemap: WebGLTexture | null
  private baseResolution: number
  private numMips: number

  constructor(gl: WebGLRenderingContext, options: MipmappedCubemapFBOOptions) {
    this.gl = gl

    this.baseResolution = options.baseResolution
    this.numMips = options.numMips

    const format = options.format
    const type = options.type

    const cubemap = gl.createTexture()
    if (!cubemap) throw new TextureCreationError('TEXTURE_CUBE_MAP')
    this.cubemap = cubemap
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemap)

    // ⚠️ 关键：必须分配完整 mip 链到 1×1，否则 LINEAR_MIPMAP_LINEAR
    //     会判定纹理为 mipmap-incomplete，所有采样返回 (0,0,0,1)。
    //
    //   WebGL 1 规范要求：当 minFilter 是 mipmap 系列时，cubemap 必须
    //   从 mip 0 一直分配到 floor(log2(max(w,h))) 级。
    //
    //   我们只**渲染**前 numMips 级（roughness 0..1 对应），但其它级
    //   也必须 texImage2D(..., null) 分配存储（内容未定义不重要，
    //   采样的 LOD 由 uMaxReflectionLod 限制在 numMips-1 以内）。
    const fullMipCount = Math.floor(Math.log2(this.baseResolution)) + 1

    for (let mip = 0; mip < fullMipCount; mip++) {
      const size = Math.max(1, this.baseResolution >> mip)

      for (let face = 0; face < 6; face++) {
        gl.texImage2D(
          gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
          mip,
          format,
          size,
          size,
          0,
          format,
          type,
          null
        )
      }
    }

    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    // gl.generateMipmap(gl.TEXTURE_CUBE_MAP)

    const fbo = gl.createFramebuffer()
    this.fbo = fbo
  }

  bindFace(face: number, mip: number): void {
    const gl = this.gl
    const size = this.baseResolution >> mip

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)

    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
      this.cubemap,
      mip
    )
    gl.viewport(0, 0, size, size)

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error('[prefilterEnvironment] incomplete FBO', { face, mip, status })
    }
  }

  releaseCubemap(): WebGLTexture {
    // 防御性编程
    if (!this.cubemap)
      throw new TextureLoadError('[MipmappedCubemapFBO]', { reason: 'cubemap already released' })

    const tex = this.cubemap
    this.cubemap = null
    return tex
  }

  dispose(): void {
    const gl = this.gl
    if (this.cubemap) {
      gl.deleteTexture(this.cubemap)
      this.cubemap = null
    }
    gl.deleteFramebuffer(this.fbo)
  }

  getNumMips(): number {
    return this.numMips
  }
}
