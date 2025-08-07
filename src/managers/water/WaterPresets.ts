import { WaterRenderManagerConfig, WaterRenderType } from '@/managers/water/WaterRenderManager'
import type { SineWaveMaterialParams } from '@/materials/SineWaveMaterial'
import { setTransform } from '@/utils/transformation'
import { GerstnerWaveMaterialParams, GerstnerWaveParams } from '@/materials/GerstnerWaveMaterial'
import { CubeMapTexture } from '@/textures/CubeMapTexture'
import { WaterMaterialParams } from '@/materials/WaterMaterial'

// 水体类型
export enum WaterType {
  TROPICAL_OCEAN = 'tropicalOcean', // 热带海洋
  DEEP_OCEAN = 'deepOcean', // 深海
  LAKE = 'lake', // 湖泊
  RIVER_MURKY = 'murkyRiver' // 河流（浑浊）
}

// 波浪类型
export enum WavesType {
  OCEAN_WAVES = 'oceanWave', // 海洋级别的波浪
  LAKE_WAVES = 'lakeWaves' // 湖泊级别的波浪
}

export class WaterPresets {
  private static instance: WaterPresets
  private gl: WebGLRenderingContext

  private constructor(gl: WebGLRenderingContext) {
    this.gl = gl
  }

  public static getInstance(gl: WebGLRenderingContext) {
    if (!WaterPresets.instance) {
      return new WaterPresets(gl)
    } else {
      return WaterPresets.instance
    }
  }

  async createSkybox(): Promise<WebGLTexture> {
    const skybox = new CubeMapTexture(this.gl)
    await skybox.createCubeMapFromImages({
      basePath: '/assets/skybox/sky_09_cubemap/',
      extension: '.png'
    })
    // console.log(skybox.texture)

    return skybox.texture
  }

  createWaterColorParams(
    waterType: WaterType
  ): Pick<
    WaterMaterialParams,
    | 'waterColor'
    | 'deepWaterColor'
    | 'shallowWaterColor'
    | 'transparency'
    | 'reflectance'
    | 'refractiveIndex'
    | 'specularPower'
  > {
    switch (waterType) {
      case WaterType.TROPICAL_OCEAN:
        // 热带海洋
        return {
          waterColor: [0.1, 0.7, 0.9],
          deepWaterColor: [0.0, 0.2, 0.6],
          shallowWaterColor: [0.3, 0.9, 0.95],
          transparency: 0.92,
          reflectance: 0.85,
          refractiveIndex: 1.34,
          specularPower: 200.0
        }
      case WaterType.DEEP_OCEAN:
        // 深海
        return {
          waterColor: [0.05, 0.3, 0.6],
          deepWaterColor: [0.0, 0.05, 0.2],
          shallowWaterColor: [0.1, 0.5, 0.8],
          transparency: 0.88,
          reflectance: 0.9,
          refractiveIndex: 1.34,
          specularPower: 256.0
        }
      case WaterType.LAKE:
        // 湖泊
        return {
          waterColor: [0.2, 0.5, 0.7],
          deepWaterColor: [0.1, 0.2, 0.4],
          shallowWaterColor: [0.4, 0.7, 0.8],
          transparency: 0.8,
          reflectance: 0.7,
          refractiveIndex: 1.333,
          specularPower: 64.0
        }
      case WaterType.RIVER_MURKY:
        // 河流（浑浊）
        return {
          waterColor: [0.3, 0.5, 0.5],
          deepWaterColor: [0.2, 0.3, 0.3],
          shallowWaterColor: [0.5, 0.7, 0.6],
          transparency: 0.7,
          reflectance: 0.5,
          refractiveIndex: 1.35,
          specularPower: 32.0
        }
    }
  }

  createWavesTypeParams(wavesType: WavesType) {
    switch (wavesType) {
      case WavesType.OCEAN_WAVES:
        // 海洋级别的波浪
        return {
          amplitude: 2.0,
          frequency: 0.1,
          speed: 1.0
        }
      case WavesType.LAKE_WAVES:
        // 湖泊级别的波浪
        return {
          amplitude: 0.5,
          frequency: 0.3,
          speed: 0.5
        }
    }
  }

  waveParameters = {
    // === 小型湖泊 ===
    smallLake: {
      amplitude: 0.05, // 振幅 A: 5cm (平静水面)
      waveVector: 0.5 * 2 * Math.PI, // 波数 k = 2π/λ, λ=4m
      angularFrequency: 1.5 * Math.PI // 角频率 ω (较缓慢)
    },

    // === 中等湖泊/池塘 ===
    mediumLake: {
      amplitude: 0.1, // 振幅 A: 10cm
      waveVector: 0.3 * 2 * Math.PI, // 波数 k, λ≈6.67m
      angularFrequency: 2 * Math.PI // 角频率 ω
    },

    // === 大型湖泊 ===
    largeLake: {
      amplitude: 0.2, // 振幅 A: 20cm
      waveVector: 0.15 * 2 * Math.PI, // 波数 k, λ≈13.33m
      angularFrequency: 2.5 * Math.PI // 角频率 ω
    },

    // === 近岸海洋 ===
    coastalOcean: {
      amplitude: 0.5, // 振幅 A: 50cm
      waveVector: 0.08 * 2 * Math.PI, // 波数 k, λ=25m
      angularFrequency: 3 * Math.PI // 角频率 ω
    },

    // === 开阔海洋 ===
    openOcean: {
      amplitude: 1.0, // 振幅 A: 1m
      waveVector: 0.05 * 2 * Math.PI, // 波数 k, λ=40m
      angularFrequency: 3.5 * Math.PI // 角频率 ω
    },

    // === 暴风雨海况 ===
    stormyOcean: {
      amplitude: 2.0, // 振幅 A: 2m
      waveVector: 0.03 * 2 * Math.PI, // 波数 k, λ≈66.67m
      angularFrequency: 4 * Math.PI // 角频frequency ω
    }
  }

  /**
   * 平静的湖水 - 使用正弦波
   * @param {number} size 水面大小
   * @param {number} resolution 水面分辨率，不要超过 255，因为 WebGL1.0 中 vertex 的索引范围为 0 ~ 65535（2^16bit）
   * */
  async createSineWave(
    size: number = 50,
    resolution: number = 250,
    waterType: WaterType = WaterType.TROPICAL_OCEAN
  ): Promise<WaterRenderManagerConfig> {
    const skyboxTexture = await this.createSkybox()
    const waterColorParams = this.createWaterColorParams(waterType)

    return {
      size,
      resolution,
      tranformation: setTransform(0, 0, 0, 1, 1, 1, 0, 0, 0),
      renderType: WaterRenderType.SINE_WAVE,
      materialParams: {
        // 纹理使用标志
        useDiffuseMap: 1,
        useNormalMap: 0,
        useEnvironmentMap: 1,
        // 基础纹理
        diffuseMap: this.gl.createTexture(),
        normalMap: this.gl.createTexture(),
        environmentMap: skyboxTexture,
        // 水体颜色参数
        waterColor: [0.2, 0.6, 0.8],
        deepWaterColor: [0.0, 0.2, 0.4],
        shallowWaterColor: [0.4, 0.9, 0.8],
        // 水体物理参数
        transparency: 0.85,
        reflectance: 0.8,
        refractiveIndex: 1.33,
        // 光照参数
        lightIntensity: [0.9, 0.9, 0.9],
        lightPos: [2, 2, 2],
        lightDir: [0.3, -0.7, 0.2],
        specularPower: 2.0,
        fresnelPower: 5.0,

        // 覆盖默认参数
        ...waterColorParams,

        // 正弦波控制参数
        amplitude: 0.2,
        waveVector: 0.03 * 2 * Math.PI,
        angularFrequency: 2 * Math.PI
      } as SineWaveMaterialParams
    }
  }

  //海洋波浪 - 使用Gerstner波
  async createGerstnerWaves(
    size: number = 50,
    resolution: number = 250,
    waterType: WaterType = WaterType.LAKE
  ): Promise<WaterRenderManagerConfig> {
    const skyboxTexture = await this.createSkybox()
    const waterColorParams = this.createWaterColorParams(waterType)

    const calm: GerstnerWaveParams[] = [
      {
        direction: [1.0, 0.0],
        steepness: 0.02, // 大幅降低！
        wavelength: 15.0, // 增加主波长
        speedMultiplier: 0.9,
        phase: 0.0
      },
      {
        direction: [0.7, 0.7],
        steepness: 0.015, // 很小的steepness
        wavelength: 8.0,
        speedMultiplier: 1.1,
        phase: Math.PI * 0.3
      }
    ]
    // 中等海浪
    const moderate: GerstnerWaveParams[] = [
      {
        direction: [1.0, 0.0],
        steepness: 0.3,
        wavelength: 10.0,
        speedMultiplier: 1.0,
        phase: 0.0
      },
      {
        direction: [0.7, 0.7],
        steepness: 0.25,
        wavelength: 8.0,
        speedMultiplier: 1.2,
        phase: Math.PI * 0.5
      },
      {
        direction: [-0.5, 0.8],
        steepness: 0.2,
        wavelength: 6.0,
        speedMultiplier: 1.5,
        phase: Math.PI
      }
    ]
    // 汹涌海面
    const rough: GerstnerWaveParams[] = [
      {
        direction: [1.0, 0.0],
        steepness: 0.5,
        wavelength: 12.0,
        speedMultiplier: 1.0,
        phase: 0.0
      },
      {
        direction: [0.7, 0.7],
        steepness: 0.4,
        wavelength: 8.0,
        speedMultiplier: 1.3,
        phase: Math.PI * 0.4
      },
      {
        direction: [-0.6, 0.8],
        steepness: 0.35,
        wavelength: 6.0,
        speedMultiplier: 1.8,
        phase: Math.PI * 0.7
      }
    ]

    const realisticOcean = [
      // === 长波浪 (Swell waves) ===
      {
        direction: [1.0, 0.0],
        steepness: 0.08,
        wavelength: 40.0, // 长波长
        speedMultiplier: 0.7, // 慢速
        phase: 0.0
      },
      {
        direction: [0.8, 0.6],
        steepness: 0.06,
        wavelength: 30.0,
        speedMultiplier: 0.8,
        phase: Math.PI * 0.3
      },

      // === 风浪 (Wind waves) ===
      {
        direction: [0.7, 0.7],
        steepness: 0.04,
        wavelength: 15.0,
        speedMultiplier: 1.2,
        phase: Math.PI * 0.5
      },
      {
        direction: [-0.6, 0.8],
        steepness: 0.035,
        wavelength: 10.0,
        speedMultiplier: 1.5,
        phase: Math.PI * 0.7
      },

      // === 毛细波 (Capillary waves) ===
      {
        direction: [0.3, 0.95],
        steepness: 0.02,
        wavelength: 5.0,
        speedMultiplier: 2.2,
        phase: Math.PI * 1.1
      },
      {
        direction: [0.9, -0.4],
        steepness: 0.015,
        wavelength: 2.5,
        speedMultiplier: 3.0,
        phase: Math.PI * 1.4
      }
    ]

    return {
      size,
      resolution,
      tranformation: setTransform(0, 0, 0, 1, 1, 1, 0, 0, 0),
      renderType: WaterRenderType.GERSTNER_WAVE,
      materialParams: {
        // 纹理使用标志
        useDiffuseMap: 1,
        useNormalMap: 0,
        useEnvironmentMap: 1,
        // 基础纹理
        diffuseMap: this.gl.createTexture(),
        normalMap: this.gl.createTexture(),
        environmentMap: skyboxTexture,
        // 水体颜色参数
        waterColor: [0.2, 0.6, 0.8],
        deepWaterColor: [0.0, 0.2, 0.4],
        shallowWaterColor: [0.4, 0.9, 0.8],
        // 水体物理参数
        transparency: 0.85,
        reflectance: 0.8,
        refractiveIndex: 1.33,
        // 光照参数
        lightIntensity: [0.9, 0.9, 0.9],
        lightPos: [2, 2, 2],
        lightDir: [0.3, -0.7, 0.2],
        specularPower: 2.0,
        fresnelPower: 5.0,

        // 覆盖默认参数
        ...waterColorParams,

        // Gerstner波控制参数
        waves: [...realisticOcean],
        waveCount: 6
      } as GerstnerWaveMaterialParams
    }
  }
}
