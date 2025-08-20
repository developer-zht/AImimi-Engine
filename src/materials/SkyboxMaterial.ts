import { getShaderString } from '@/loaders/loadShader'
import { CubeMapTexture } from '@/textures/CubeMapTexture'
import { Material } from '@/materials/Material'
import { Uniforms, UniformType } from '@/types/Material'
import { HDRCubeMapTexture } from '@/textures/HDRCubeMapTexture'
import { TextureType } from '@/managers/cubemap/CubeMapRenderManager'

export class SkyboxMaterial extends Material {
  private gl: WebGLRenderingContext
  private cubeMapTexture: CubeMapTexture
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
    this.cubeMapTexture = new CubeMapTexture(this.gl)
  }

  async setTexUniform(textureType: TextureType = TextureType.HDR_FILE) {
    try {
      switch (textureType) {
        case TextureType.CUBE_MAP:
          await this.cubeMapTexture.createCubeMapFromImages({
            basePath: '/assets/textures/skyboxes/sky_09_cubemap/',
            extension: '.png'
          })
          this.uniforms['uSkyboxMap'].value = this.cubeMapTexture.texture
        case TextureType.HDR_FILE:
          this.uniforms['uSkyboxMap'].value = HDRCubeMapTexture.getInstance(this.gl).envCubemap
      }
    } catch (error) {
      throw new Error(error)
    }
  }
}

export async function buildSkyboxMaterial(
  gl: WebGLRenderingContext,
  vertexPath: string,
  fragmentPath: string,
  textureType: TextureType
): Promise<SkyboxMaterial> {
  let vertexShaderContent = await getShaderString(vertexPath)
  let fragmentShaderContent = await getShaderString(fragmentPath)

  const skyboxMaterial = new SkyboxMaterial(gl, vertexShaderContent, fragmentShaderContent)
  await skyboxMaterial.setTexUniform(textureType)
  // console.log(skyboxMaterial.uniforms['uSkyboxMap'].value)

  return skyboxMaterial
}
