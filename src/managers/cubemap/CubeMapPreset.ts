import { setTransform } from '@/utils/transformation'
import { ImgBasedCubeMapTexture } from '@/textures/ImgBasedCubeMapTexture'
import { FileExtensions, TexturePaths } from '@/config/resourcePaths'
import { HDRBasedCubeMapTexture } from '@/textures/HDRBasedCubeMapTexture'
import { CubeMapRenderManagerParams, CubeMapType, TextureType } from '@/types/CubeMapRender'

export class CubeMapPreset {
  /**
   * skybox vertices data
   */
  static async createSkybox(gl: WebGLRenderingContext, textureType: TextureType) {
    let texture: WebGLTexture
    switch (textureType) {
      case TextureType.IMG_CUBE_MAP: {
        const imgBasedCubeMapTexture = new ImgBasedCubeMapTexture(gl)
        console.log(TexturePaths.SKY_09_CUBEMAP)

        await imgBasedCubeMapTexture.createCubeMapFromImages({
          basePath: TexturePaths.SKY_SUNSET,
          extension: FileExtensions.PNG
        })
        texture = imgBasedCubeMapTexture.texture
        break
      }
      case TextureType.HDR_CUBE_MAP: {
        texture = HDRBasedCubeMapTexture.getInstance(gl).envCubemap
        break
      }
    }

    const cubeMapRenderManagerParams: CubeMapRenderManagerParams = {
      transformation: setTransform(0, 0, 0, 1, 1, 1, 0, 0, 0),
      cubeMapType: CubeMapType.SKYBOX,
      // textureType: TextureType.HDR_FILE
      texture
    }

    return cubeMapRenderManagerParams
  }
}
