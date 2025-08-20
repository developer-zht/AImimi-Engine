import { setTransform } from '@/utils/transformation'
import { FFTOceanRenderManagerConfig } from './FFTOceanRenderManager'

export class FFTOceanPresets {
  private static instance: FFTOceanPresets
  private gl: WebGLRenderingContext

  private constructor(gl: WebGLRenderingContext) {
    this.gl = gl
  }

  public static getInstance(gl: WebGLRenderingContext) {
    if (!FFTOceanPresets.instance) {
      FFTOceanPresets.instance = new FFTOceanPresets(gl)
      return FFTOceanPresets.instance
    } else {
      return FFTOceanPresets.instance
    }
  }

  createFFTOceanParams(): FFTOceanRenderManagerConfig {
    return {
      tranformation: setTransform(0, 0, 0, 1, 1, 1, 0, 0, 0),
      materialParams: {
        // 纹理使用标志
        useDiffuseMap: 0,
        useNormalMap: 1,
        useEnvironmentMap: 0,
        // 基础纹理
        diffuseMap: null,
        normalMap: null,
        environmentMap: null,
        // 水体颜色参数
        waterColor: [0.2, 0.6, 0.8],
        deepWaterColor: [0.0, 0.2, 0.4],
        shallowWaterColor: [0.4, 0.9, 0.8],
        // 水体物理参数
        transparency: 0.85,
        reflectance: 0.8,
        refractiveIndex: 1.33,
        // 波浪控制参数
        time: 0.0,
        // 光照参数
        lightColor: [0.9, 0.9, 0.9],
        lightPos: [2, 2, 2],
        lightDir: [0.3, -0.7, 0.2],
        specularPower: 2.0,
        fresnelPower: 5.0,

        displacementMap: null
      },
      oceanParams: {
        size: 64, // 100米的海面
        resolution: 64, // 256x256网格
        windSpeed: 20, // 20m/s风速
        windDirection: { x: 1, y: 0 }, // 东风
        gravity: 9.81,
        choppiness: 1.2
      }
    }
  }
}
