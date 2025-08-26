import { Material } from '@/materials/Material'
import { Texture } from '@/textures/Texture'
import { getShaderString } from '@/loaders/loadShader'
import { UniformType } from '@/types/Material'

export class SceneDepthMaterial extends Material {
  constructor(
    color: Texture,
    vertexShader: string,
    fragmentShader: string,
    bufferFBO: WebGLFramebuffer
  ) {
    super(
      {
        uSampler: { type: UniformType.TEXTURE_2D, value: color }
      },
      [],
      vertexShader,
      fragmentShader,
      bufferFBO
    )
    this.notShadow = true
  }
}

async function buildSceneDepthMaterial(
  color: Texture,
  vertexPath: string,
  fragmentPath: string,
  bufferFBO: WebGLFramebuffer
): Promise<SceneDepthMaterial> {
  const vertexShader = await getShaderString(vertexPath)
  const fragmentShader = await getShaderString(fragmentPath)

  return new SceneDepthMaterial(color, vertexShader, fragmentShader, bufferFBO)
}
