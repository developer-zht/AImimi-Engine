import { Material } from '@/materials/Material'
import { getShaderString } from '@/loaders/loadShader'
import { Light } from '@/types/light'
import { UniformType } from '@/types/Material'

export class ShadowMaterial extends Material {
  constructor(light: Light, vertexShader: string, fragmentShader: string) {
    const lightVP = light.CalcDirectionalLightVP()

    super(
      {
        uLightVP: { type: UniformType.MATRIX_4FV, value: lightVP }
      },
      [],
      vertexShader,
      fragmentShader,
      light.fbo
    )
  }
}

export async function buildShadowMaterial(
  light: Light,
  vertexPath: string,
  fragmentPath: string
): Promise<ShadowMaterial> {
  const vertexShader = await getShaderString(vertexPath)
  const fragmentShader = await getShaderString(fragmentPath)

  return new ShadowMaterial(light, vertexShader, fragmentShader)
}
