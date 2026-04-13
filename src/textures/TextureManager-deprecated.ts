import { CubeMapConfig, ImgBasedCubeMapTexture } from '@/textures/ImgBasedCubeMapTexture-deprecated'

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
    const imgBasedCubeMapTexture = new ImgBasedCubeMapTexture(gl)
    await imgBasedCubeMapTexture.createCubeMapFromImages(config)

    this.cubeMapCache.set(key, imgBasedCubeMapTexture.texture!)
    return imgBasedCubeMapTexture.texture!
  }

  static clearCache(gl: WebGLRenderingContext) {
    this.cubeMapCache.forEach((texture) => {
      gl.deleteTexture(texture)
    })
    this.cubeMapCache.clear()
  }
}
