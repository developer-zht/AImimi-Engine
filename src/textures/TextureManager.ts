import { CubeMapConfig, CubeMapTexture } from './CubeMapTexture'

export class TextureManager {
  private static cubeMapCache = new Map<string, WebGLTexture>()

  static async getSharedCubeMap(
    gl: WebGLRenderingContext,
    config: CubeMapConfig
  ): Promise<WebGLTexture> {
    const key = config.basePath + config.extension

    if (this.cubeMapCache.has(key)) {
      console.log(`🎯 使用缓存的立方体贴图: ${key}`)
      return this.cubeMapCache.get(key)!
    }

    console.log(`🆕 创建新的立方体贴图: ${key}`)
    const cubeMapTexture = new CubeMapTexture(gl)
    await cubeMapTexture.createCubeMapFromImages(config)

    this.cubeMapCache.set(key, cubeMapTexture.texture!)
    return cubeMapTexture.texture!
  }

  static clearCache(gl: WebGLRenderingContext) {
    this.cubeMapCache.forEach((texture) => {
      gl.deleteTexture(texture)
    })
    this.cubeMapCache.clear()
  }
}
