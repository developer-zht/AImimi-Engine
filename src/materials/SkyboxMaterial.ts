import { getShaderString } from '@/loaders/loadShader'
import { CubeMapTexture } from '@/textures/CubeMapTexture'
import { Material } from '@/materials/Material'
import { Uniforms } from '@/types/Material'
import { TextureManager } from '@/textures/TextureManager'

export class SkyboxMaterial extends Material {
  private cubeMapTexture: CubeMapTexture
  constructor(
    gl: WebGLRenderingContext,
    vertexShaderContent: string,
    fragmentShaderContent: string
  ) {
    const baseUniforms: Uniforms = {
      uSkyboxMap: {
        type: 'textureCube',
        value: null
      }
    }
    super(baseUniforms, [], vertexShaderContent, fragmentShaderContent, null)
    this.cubeMapTexture = new CubeMapTexture(gl)
  }

  async setTexUniform() {
    try {
      await this.cubeMapTexture.createCubeMapFromImages({
        basePath: '/assets/skybox/sky_18_cubemap/',
        extension: '.png'
      })
      this.uniforms['uSkyboxMap'].value = this.cubeMapTexture.texture
      console.log(this.cubeMapTexture.texture)
    } catch (error) {
      throw new Error(error)
    }
  }
}

export async function buildSkyboxMaterial(
  gl: WebGLRenderingContext,
  vertexPath: string,
  fragmentPath: string
): Promise<SkyboxMaterial> {
  let vertexShaderContent = await getShaderString(vertexPath)
  let fragmentShaderContent = await getShaderString(fragmentPath)

  const skyboxMaterial = new SkyboxMaterial(gl, vertexShaderContent, fragmentShaderContent)
  await skyboxMaterial.setTexUniform()
  // console.log(skyboxMaterial.uniforms['uSkyboxMap'].value)

  return skyboxMaterial
}
