import { TextureCreationError } from '@/errors/EngineError/TextureError/TextureCreationError'
import { isPowerOf2 } from '@/math/isPowerOf2'
import type { Vec3 } from '@/math/types/math'
import { TextureImageSource } from './types/texture'

export class Texture {
  private static cache = new Map<string, Texture>() // 2D 纹理缓存

  private gl: WebGLRenderingContext

  private handle: WebGLTexture | null = null

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl
  }

  /** 安全获取，可能为 null */
  get glTexture(): WebGLTexture | null {
    return this.handle
  }

  /** 断言获取，未初始化直接 throw */
  get glTextureOrThrow(): WebGLTexture {
    if (!this.handle) {
      throw new TextureCreationError('TEXTURE_2D', {
        reason: 'Texture not yet created. Call createFromImage / createFromColor first.'
      })
    }
    return this.handle
  }

  /**
   * 有缓存就返回缓存，没有就用 factory 创建并缓存
   * factory 由调用者传入，所以创建方式完全灵活
   */
  // TODO: 环境反射时启用
  // static async getOrCreate(key: string, factory: () => Promise<Texture>): Promise<Texture> {
  //   const cached = Texture.cache.get(key)
  //   if (cached) return cached

  //   const tex = await factory()
  //   Texture.cache.set(key, tex)
  //   return tex
  // }

  // static clearCache(): void {
  //   Texture.cache.forEach((texture) => texture.dispose())
  //   Texture.cache.clear()
  // }

  createFromImage(image: TextureImageSource): void {
    const gl = this.gl

    this.handle = gl.createTexture()
    if (!this.handle) {
      throw new TextureCreationError('TEXTURE_2D')
    }

    // 这段很有参考意义，但在此处是多余的
    // Because images have to be download over the internet
    // they might take a moment until they are ready.
    // Until then put a single pixel in the texture so we cage has finished downloading
    // we'll update the texture with the contents of the image.
    // this.createFromColor([0, 0, 255])

    gl.bindTexture(gl.TEXTURE_2D, this.handle)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true) // 设置为 true 后，所有后续的 texImage2D 调用都会翻转 Y 轴，直到手动设回 false
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)

    this.setupFiltering(image.width, image.height)

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false) // 恢复！
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  /** 根据尺寸设置过滤模式 */
  private setupFiltering(width: GLsizei, height: GLsizei): void {
    const gl = this.gl

    // WebGL 1 的限制：只有尺寸是 2 的幂（Power of 2: 1, 2, 4, 8, ..., 256, 512, 1024...）的纹理才能生成 mipmap 并使用 REPEAT 缠绕模式。
    // 非 2 的幂（NPOT）纹理有严格限制。
    if (isPowerOf2(width) && isPowerOf2(height)) {
      // Yes, it's a power of 2. Generate mips.
      gl.generateMipmap(gl.TEXTURE_2D)
    } else {
      // 非 2 的幂纹理：不能用 mipmap，不能用 REPEAT
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    }
  }

  /** 从纯色创建 1x1 纹理 */
  createFromColor(color: Vec3, gamma: boolean = false): void {
    const gl = this.gl
    this.handle = gl.createTexture()
    if (!this.handle) {
      throw new TextureCreationError('TEXTURE_2D')
    }

    const pixel = gamma
      ? new Uint8Array([
          Math.pow(color[0], 1.0 / 2.2) * 255,
          Math.pow(color[1], 1.0 / 2.2) * 255,
          Math.pow(color[2], 1.0 / 2.2) * 255,
          255
        ])
      : new Uint8Array([color[0] * 255, color[1] * 255, color[2] * 255, 255])

    gl.bindTexture(gl.TEXTURE_2D, this.handle)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel)

    // 1x1 纹理不需要 mipmap
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  dispose() {
    if (this.handle) {
      this.gl.deleteTexture(this.handle)
      this.handle = null
    }
  }
}
