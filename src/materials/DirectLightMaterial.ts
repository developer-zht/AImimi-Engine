import { Material } from '@/materials/Material'
import { getShaderString } from '@/loaders/loadShader'
import { DirectionalLight } from '@/lights/DirectionalLight'

import type { Vec3 } from '@/types/math'
import { UniformType } from '@/types/Material'

export class DirectLightMaterial extends Material {
  constructor(
    color: Vec3,
    specular: Vec3,
    light: DirectionalLight,
    translate: Vec3,
    scale: Vec3,
    vertexShader: string,
    fragmentShader: string
  ) {
    const lightMVP = light.CalcDirectionalLightMVP(translate, scale)
    const lightIntensity = light.material.GetIntensity()

    super(
      {
        // Phong
        uSampler: { type: UniformType.TEXTURE_2D, value: color },
        uKs: { type: UniformType.THREE_FV, value: specular },
        uLightRadiance: { type: UniformType.THREE_FV, value: lightIntensity },
        // Shadow
        uShadowMap: { type: UniformType.TEXTURE_2D, value: light.fbo },
        uLightMVP: { type: UniformType.MATRIX_4FV, value: lightMVP }
      },
      [],
      vertexShader,
      fragmentShader,
      null
    )
  }
}

async function buildDirectLightMaterial(
  color: Vec3,
  specular: Vec3,
  light: DirectionalLight,
  translate: Vec3,
  scale: Vec3,
  vertexPath: string,
  fragmentPath: string
) {
  const vertexShader = await getShaderString(vertexPath)
  const fragmentShader = await getShaderString(fragmentPath)

  return new DirectLightMaterial(
    color,
    specular,
    light,
    translate,
    scale,
    vertexShader,
    fragmentShader
  )
}
