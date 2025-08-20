import { setTransform } from '@/utils/transformation'
import { CubeMapRenderManagerParams, CubeMapType } from './CubeMapRenderManager'

export class CubeMapPreset {
  /**
   * skybox vertices data
   */
  static createSkybox() {
    const cubeMapRenderManagerParams: CubeMapRenderManagerParams = {
      transformation: setTransform(0, 0, 0, 1, 1, 1, 0, 0, 0),
      cubeMapType: CubeMapType.SKYBOX
    }

    return cubeMapRenderManagerParams
  }
}
