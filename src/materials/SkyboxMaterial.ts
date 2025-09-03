import { getShaderString } from '@/loaders/loadShader'
import { Material } from '@/materials/Material'
import { Uniforms, UniformType } from '@/types/Material'

export class SkyboxMaterial extends Material {
  private gl: WebGLRenderingContext
  // private cubeMapTexture: CubeMapTexture
  constructor(
    gl: WebGLRenderingContext,
    vertexShaderContent: string,
    fragmentShaderContent: string
  ) {
    const baseUniforms: Uniforms = {
      uSkyboxMap: {
        type: UniformType.TEXTURE_CUBE,
        value: null
      }
    }
    super(baseUniforms, [], vertexShaderContent, fragmentShaderContent, null)
    this.gl = gl
  }

  setTexUniform(texture: WebGLTexture) {
    this.uniforms['uSkyboxMap'].value = texture
  }
}

export async function buildSkyboxMaterial(
  gl: WebGLRenderingContext,
  vertexPath: string,
  fragmentPath: string,
  texture: WebGLTexture
): Promise<SkyboxMaterial> {
  const vertexShaderContent = await getShaderString(vertexPath)
  const fragmentShaderContent = await getShaderString(fragmentPath)

  const skyboxMaterial = new SkyboxMaterial(gl, vertexShaderContent, fragmentShaderContent)
  skyboxMaterial.setTexUniform(texture)
  // console.log(skyboxMaterial.uniforms['uSkyboxMap'].value)

  return skyboxMaterial
}
