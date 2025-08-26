import { Material } from '@/materials/Material'
import { getShaderString } from '@/loaders/loadShader'
import { PerspectiveCamera } from 'three'
import { Light } from '@/types/light'
import { Texture } from '@/textures/Texture'
import { UniformType } from '@/types/Material'

export class GBufferMaterial extends Material {
  constructor(
    diffuseMap: Texture,
    normalMap: Texture,
    light: Light,
    camera: PerspectiveCamera,
    vertexShader: string,
    fragmentShader: string
  ) {
    const lightVP = light.CalcDirectionalLightVP()

    super(
      {
        uKd: { type: UniformType.TEXTURE_2D, value: diffuseMap.texture },
        uNt: { type: UniformType.TEXTURE_2D, value: normalMap.texture },

        uLightVP: { type: UniformType.MATRIX_4FV, value: lightVP },
        uShadowMap: { type: UniformType.TEXTURE_2D, value: light.fbo.textures[0] }
      },
      [],
      vertexShader,
      fragmentShader,
      camera.fbo
    )
  }
}

export async function buildGbufferMaterial(
  diffuseMap: Texture,
  normalMap: Texture,
  light: Light,
  camera: PerspectiveCamera,
  vertexPath: string,
  fragmentPath: string
): Promise<GBufferMaterial> {
  const vertexShader = await getShaderString(vertexPath)
  const fragmentShader = await getShaderString(fragmentPath)

  return new GBufferMaterial(diffuseMap, normalMap, light, camera, vertexShader, fragmentShader)
}
