import { TextureCreationError } from '@/errors/EngineError/TextureError/TextureCreationError'
import { DataTexture } from 'three'
import { convertHDRToCubeMap } from './converters/convertHDRToCubeMap'
import { TextureImageSource } from './types/texture'

export class CubeMapTexture {
  private static cache: Map<string, CubeMapTexture> = new Map()

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
      throw new TextureCreationError('TEXTURE_CUBE_MAP', {
        reason:
          'CubeMap texture not yet created. Call createFromImages / createCubeMapFromHDR first.'
      })
    }
    return this.handle
  }

  // ---------- 缓存 ----------
  // TODO: 环境反射时启用
  // static async getOrCreate(
  //   key: string,
  //   factory: () => Promise<CubeMapTexture>
  // ): Promise<CubeMapTexture> {
  //   const cached = CubeMapTexture.cache.get(key)
  //   if (cached) return cached

  //   const tex = await factory()
  //   CubeMapTexture.cache.set(key, tex)
  //   return tex
  // }

  // static clearCache() {
  //   CubeMapTexture.cache.forEach((texture) => texture.dispose())
  //   CubeMapTexture.cache.clear()
  // }

  /**
   * 创建方式 1：从 6 张已加载的图片创建 CubeMap
   * ⚠️ 只负责"创建 GPU 资源"，不负责"加载图片"
   */
  createFromImages(images: TextureImageSource[]): void {
    const gl = this.gl

    if (images.length !== 6) {
      throw new TextureCreationError('TEXTURE_CUBE_MAP', {
        reason: `CubeMap requires exactly 6 images, got ${images.length}`
      })
    }

    this.handle = gl.createTexture()
    if (!this.handle) {
      throw new TextureCreationError('TEXTURE_CUBE_MAP')
    }

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.handle)

    // const faceTargets = [
    //   gl.TEXTURE_CUBE_MAP_POSITIVE_X, // px - 右
    //   gl.TEXTURE_CUBE_MAP_NEGATIVE_X, // nx - 左
    //   gl.TEXTURE_CUBE_MAP_POSITIVE_Y, // py - 上
    //   gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, // ny - 下
    //   gl.TEXTURE_CUBE_MAP_POSITIVE_Z, // pz - 前
    //   gl.TEXTURE_CUBE_MAP_NEGATIVE_Z // nz - 后
    // ] as const

    // images.forEach((img, index) => {
    //   gl.texImage2D(faceTargets[index], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    // })

    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      if (image) {
        gl.texImage2D(
          gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          image
        )
      } else {
        throw new TextureCreationError('TEXTURE_CUBE_MAP', {
          reason: 'CubeMap require HTMLImageElement'
        })
      }
    }

    // 设置采样参数
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null)
  }

  /** 创建方式 2：接管一个已存在的 WebGLTexture handle */
  adoptHandle(handle: WebGLTexture): void {
    // 如果之前有旧的，先释放
    if (this.handle) {
      this.gl.deleteTexture(this.handle)
    }
    this.handle = handle
  }

  /** 创建方式 3（静态工厂）：从 HDR 文件创建 CubeMap */
  async createCubeMapFromHDR(
    hdrData: DataTexture,
    resolution: number,
    options: {
      flipY: boolean
      rotationY: number
    }
  ): Promise<void> {
    // 1. 转换
    const handle = await convertHDRToCubeMap(this.gl, hdrData, resolution, options)
    // 2. 包装
    this.adoptHandle(handle)
  }

  dispose() {
    if (this.handle) {
      this.gl.deleteTexture(this.handle)
      this.handle = null
    }
  }
}
