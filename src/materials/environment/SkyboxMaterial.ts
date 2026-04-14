import { Material } from '@/materials/Material'
import { UniformType } from '@/materials/types/Material'
import { SKYBOX_UNIFORM } from '../_config/constants'

export class SkyboxMaterial extends Material {
  constructor(label: string) {
    super(
      label,
      {
        [SKYBOX_UNIFORM.SKYBOX_MAP]: {
          type: UniformType.TEXTURE_CUBE,
          value: null
        }
      },
      null
    )
  }

  setTexUniform(name: string, texture: WebGLTexture): void {
    const uniform = this.uniforms[name]
    if (!uniform) {
      throw new Error()
    }
    uniform.value = texture
  }
}
