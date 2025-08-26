import { getShaderString } from '@/loaders/loadShader'
import { WaterMaterial, WaterMaterialParams } from '@/materials/WaterMaterial'
import { Uniforms, UniformType } from '@/types/Material'

export interface FFTOceanMaterialParams extends WaterMaterialParams {
  // 几何纹理
  displacementMap: WebGLTexture
  // normalTexture: WebGLTexture

  // 水体参数
  specularStrength?: number
  foamThreshold?: number
}

export class FFTOceanMaterial extends WaterMaterial {
  private fftOceanParameters: FFTOceanMaterialParams

  constructor(
    fftOceanParams: FFTOceanMaterialParams,
    vertexShaderContent: string,
    fragmentShaderContent: string
  ) {
    // 设置默认参数
    let defaultFFTOceanParams: FFTOceanMaterialParams = {
      // 纹理使用标志
      useDiffuseMap: 0,
      useNormalMap: 1,
      useEnvironmentMap: 0,
      // 基础纹理
      diffuseMap: null,
      normalMap: null,
      environmentMap: null,
      // 水体颜色参数
      waterColor: [0.1, 0.3, 0.5],
      deepWaterColor: [0.0, 0.1, 0.2],
      shallowWaterColor: [0.2, 0.6, 0.8],
      // 水体物理参数
      transparency: 0.8,
      reflectance: 0.3,
      refractiveIndex: 1.33,
      // 水深模型参数
      depthModel: 2,
      maxDepth: 50.0,
      minDepth: 1.0,
      depthCenter: [0, 0],
      depthFalloff: 1.5,
      // 波浪控制参数
      time: 0.0,
      // 光照参数
      lightColor: [0.9, 0.9, 0.9],
      lightPos: [2, 2, 2],
      lightDir: [0.3, -0.7, 0.2],
      specularPower: 32.0,
      fresnelPower: 5.0,

      // FFT Ocean Params
      displacementMap: null
      // normalTexture: null
    }

    const fftOceanParameters = {
      ...defaultFFTOceanParams,
      // 作用：覆盖默认值
      ...fftOceanParams
    }

    // 构建 FFT Ocean 特有的 uniforms
    const fftOceanUniforms: Uniforms = {
      uDisplacementMap: {
        type: UniformType.TEXTURE_2D,
        value: fftOceanParameters.displacementMap
      },
      uNormalMap: { type: UniformType.TEXTURE_2D, value: fftOceanParameters.normalMap }
    }

    super(fftOceanParameters, vertexShaderContent, fragmentShaderContent, fftOceanUniforms)

    this.fftOceanParameters = fftOceanParameters
  }
}

export async function buildFFTOceanMaterial(
  fftOceanParams: FFTOceanMaterialParams,
  vertexPath: string,
  fragmentPath: string
): Promise<FFTOceanMaterial> {
  let vertexShaderContent = await getShaderString(vertexPath)
  let fragmentShaderContent = await getShaderString(fragmentPath)

  return new FFTOceanMaterial(fftOceanParams, vertexShaderContent, fragmentShaderContent)
}
