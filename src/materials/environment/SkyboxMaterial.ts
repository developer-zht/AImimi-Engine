import { Material } from '@/materials/Material'
import { UniformType } from '@/materials/types/Material'
import { SkyboxMaterialConfig } from './types/SkyboxMaterial'

export class SkyboxMaterial extends Material {
  constructor(label: string, config: SkyboxMaterialConfig) {
    super(
      label,
      {
        uSkyboxMap: {
          type: UniformType.TEXTURE_CUBE,
          value: config.skyboxMap
        },
        uIsHDR: {
          type: UniformType.ONE_I,
          value: config.isHDR
        },
        uExposure: {
          type: UniformType.ONE_F,
          value: config.exposure
        }
      },
      null
    )
  }

  // setTexUniform(name: string, texture: WebGLTexture): void {
  //   const uniform = this.uniforms[name]
  //   if (!uniform) {
  //     throw new Error()
  //   }
  //   uniform.value = texture
  // }
}
