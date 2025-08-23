import { Material } from '@/materials/Material'
import { getShaderString } from '@/loaders/loadShader'
import { Light } from '@/types/light'
import { PerspectiveCamera } from 'three'
import { Texture } from '@/textures/Texture'
import { UniformType } from '@/types/Material'

export class SSRMaterial extends Material {
  constructor(
    diffuseMap: Texture,
    specularMap: Texture,
    light: Light,
    camera: PerspectiveCamera,
    vertexShader: string,
    fragmentShader: string
  ) {
    let lightIntensity = light.material.GetIntensity()
    let lightVP = light.CalcDirectionalLightVP()
    let lightDir = light.CalcDirectionalShadingDirection()

    super(
      {
        uLightRadiance: { type: UniformType.THREE_FV, value: lightIntensity },
        uLightDir: { type: UniformType.THREE_FV, value: lightDir },
        uGDiffuse: { type: UniformType.TEXTURE_2D, value: camera.fbo.textures[0] },
        uGDepth: { type: UniformType.TEXTURE_2D, value: camera.fbo.textures[1] },
        uGNormalWorld: { type: UniformType.TEXTURE_2D, value: camera.fbo.textures[2] },
        uGShadow: { type: UniformType.TEXTURE_2D, value: camera.fbo.textures[3] },
        uGPosWorld: { type: UniformType.TEXTURE_2D, value: camera.fbo.textures[4] }
      },
      [],
      vertexShader,
      fragmentShader,
      null
    )
  }
}

export async function buildSSRMaterial(
  diffuseMap: Texture,
  specularMap: Texture,
  light: Light,
  camera: PerspectiveCamera,
  vertexPath: string,
  fragmentPath: string
): Promise<SSRMaterial> {
  let vertexShader = await getShaderString(vertexPath)
  let fragmentShader = await getShaderString(fragmentPath)

  return new SSRMaterial(diffuseMap, specularMap, light, camera, vertexShader, fragmentShader)
}
