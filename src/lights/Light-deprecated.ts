import { Material } from '@/materials/Material-deprecated'
import {
  LightCubeVertexShader,
  LightCubeFragmentShader
} from '@/shaders/deprecated-InternalShader/InternalShader'

import type { LightParams } from './types/light'
import { UniformType } from '@/materials/types/Material'

export class EmissiveMaterial extends Material {
  // public
  private color: LightParams['lightRadiance']

  constructor(lightRadiance: LightParams['lightRadiance']) {
    super(
      {
        uLightRadiance: { type: UniformType.THREE_FV, value: lightRadiance }
      },
      [],
      LightCubeVertexShader,
      LightCubeFragmentShader,
      null
    )

    this.color = lightRadiance
  }

  GetIntensity(): LightParams['lightRadiance'] {
    return this.color
  }
}
