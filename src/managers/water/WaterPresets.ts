import { WaterRenderManagerConfig, WaterRenderType } from '@/managers/water/WaterRenderManager'
import type { SineWaveMaterialParams } from '@/materials/SineWaveMaterial'
import { setTransform } from '@/utils/transformation'
import { GerstnerWaveMaterialParams, GerstnerWaveParams } from '@/materials/GerstnerWaveMaterial'
import { ImgBasedCubeMapTexture } from '@/textures/ImgBasedCubeMapTexture'
import { WaterMaterialParams } from '@/materials/WaterMaterial'
import { HDRBasedCubeMapTexture } from '@/textures/HDRBasedCubeMapTexture'
import { FileExtensions, TexturePaths } from '@/config/resourcePaths'

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
    // const skybox = new CubeMapTexture(this.gl)
    // await skybox.createCubeMapFromImages({
    //   basePath: TexturePaths.SKY_09_CUBEMAP,
    //   extension: FileExtensions.PNG
    // })
    // const skyboxTexture = skybox.texture

    const skyboxTexture = HDRBasedCubeMapTexture.getInstance(this.gl).envCubemap

    // console.log(skybox.texture)

    return skyboxTexture
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

  private waveParameters = {
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
    size: number = 250,
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
        // 水深模型参数
        depthModel: 2,
        maxDepth: 50.0,
        minDepth: 1.0,
        depthCenter: [0, 0],
        depthFalloff: 1.5,
        // 光照参数
        lightColor: [0.9, 0.9, 0.9],
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
    size: number = 800,
    resolution: number = 250,
    waterType: WaterType = WaterType.LAKE
  ): Promise<WaterRenderManagerConfig> {
    const skyboxTexture = await this.createSkybox()
    const waterColorParams = this.createWaterColorParams(waterType)

    // === 1. 平静海面 (Calm Sea) ===
    // 特征: 长周期涌浪 + 微小风浪
    const calm = [
      // 主涌浪 (Primary Swell) - 来自远方风暴
      {
        direction: [1.0, 0.0], // 主方向：正东
        steepness: 0.15, // 较低陡峭度，圆润波形
        wavelength: 80.0, // 长波长涌浪
        speedMultiplier: 0.95, // 接近理论波速
        phase: 0.0
      },
      {
        direction: [0.8, 0.6], // 辅助涌浪方向
        steepness: 0.08, // 更小的陡峭度
        wavelength: 60.0, // 次级波长
        speedMultiplier: 1.05,
        phase: Math.PI * 0.3
      }
      // 微风浪 (Light Wind Waves)
      // {
      //   direction: [0.7, 0.7],
      //   steepness: 0.05, // 很小的陡峭度
      //   wavelength: 25.0, // 中等波长
      //   speedMultiplier: 1.2,
      //   phase: Math.PI * 0.7
      // }
    ]

    // === 2. 中等海况 (Moderate Sea) ===
    // 特征: 风浪主导 + 涌浪背景 + 明显的波峰
    const moderate = [
      // 主风浪 (Primary Wind Waves)
      {
        direction: [1.0, 0.0],
        steepness: 0.35, // 中等陡峭度，开始有尖锐波峰
        wavelength: 45.0, // 风浪典型波长
        speedMultiplier: 1.0,
        phase: 0.0
      },
      {
        direction: [0.866, 0.5], // 30度偏角
        steepness: 0.25,
        wavelength: 32.0,
        speedMultiplier: 1.15,
        phase: Math.PI * 0.4
      },
      // 次级风浪
      {
        direction: [0.5, 0.866], // 60度偏角
        steepness: 0.18,
        wavelength: 20.0,
        speedMultiplier: 1.3,
        phase: Math.PI * 0.8
      }
      // 背景涌浪
      // {
      //   direction: [0.9, -0.436], // 来自不同方向的涌浪
      //   steepness: 0.12,
      //   wavelength: 75.0, // 长周期涌浪
      //   speedMultiplier: 0.9,
      //   phase: Math.PI * 1.2
      // }
    ]

    // === 3. 汹涌海面 (Rough Sea) ===
    // 特征: 高陡峭度 + 多方向风浪 + 复杂相互作用
    const rough = [
      // 主导风浪 (Dominant Wind Waves)
      {
        direction: [1.0, 0.0],
        steepness: 0.45, // 高陡峭度，尖锐波峰
        wavelength: 35.0,
        speedMultiplier: 1.0,
        phase: 0.0
      },
      {
        direction: [0.707, 0.707], // 45度交叉波浪
        steepness: 0.35,
        wavelength: 28.0,
        speedMultiplier: 1.1,
        phase: Math.PI * 0.3
      },
      {
        direction: [0.259, 0.966], // 75度方向
        steepness: 0.25,
        wavelength: 22.0,
        speedMultiplier: 1.25,
        phase: Math.PI * 0.6
      },
      // 短周期风浪
      {
        direction: [-0.5, 0.866], // 逆向波浪
        steepness: 0.18,
        wavelength: 15.0,
        speedMultiplier: 1.4,
        phase: Math.PI * 0.9
      },
      // 高频细节波
      {
        direction: [0.8, -0.6],
        steepness: 0.12,
        wavelength: 8.0,
        speedMultiplier: 1.8,
        phase: Math.PI * 1.3
      }
    ]

    // === 4. 风暴海面 (Storm Sea) ===
    // 特征: 极高波浪 + 接近陡峭度极限 + 泡沫密集
    const storm = [
      // 风暴主波
      {
        direction: [1.0, 0.0],
        steepness: 0.55, // 接近极限的陡峭度
        wavelength: 40.0,
        speedMultiplier: 0.95,
        phase: 0.0
      },
      {
        direction: [0.8, 0.6],
        steepness: 0.4,
        wavelength: 30.0,
        speedMultiplier: 1.05,
        phase: Math.PI * 0.25
      },
      {
        direction: [0.6, 0.8],
        steepness: 0.3,
        wavelength: 20.0,
        speedMultiplier: 1.2,
        phase: Math.PI * 0.5
      },
      {
        direction: [0.0, 1.0],
        steepness: 0.22,
        wavelength: 15.0,
        speedMultiplier: 1.4,
        phase: Math.PI * 0.75
      },
      {
        direction: [-0.707, 0.707],
        steepness: 0.15,
        wavelength: 10.0,
        speedMultiplier: 1.7,
        phase: Math.PI * 1.1
      },
      // 破碎波细节
      {
        direction: [0.9, -0.436],
        steepness: 0.08,
        wavelength: 5.0,
        speedMultiplier: 2.2,
        phase: Math.PI * 1.4
      }
    ]

    // 浅海湾（适合展示颜色变化）
    const shallowBay = {
      depthModel: 2,
      maxDepth: 15.0,
      minDepth: 0.5,
      depthCenter: [0, 0],
      depthFalloff: 1.2
    }

    // 海岸线到深海
    const coastalWaters = {
      depthModel: 1,
      maxDepth: 40.0,
      minDepth: 1.0,
      depthCenter: [0, 0],
      depthFalloff: 1.0
    }

    // 复杂海洋地形
    const oceanBasin = {
      depthModel: 3,
      maxDepth: 60.0,
      minDepth: 2.0,
      depthCenter: [100, -50], // 偏离中心
      depthFalloff: 2.0
    }

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
        shallowWaterColor: [0.4, 0.9, 0.9],
        waterColor: [0.2, 0.6, 0.8],
        deepWaterColor: [0.0, 0.3, 0.6],
        // 墨蓝色 - 深渊色 [0.0, 0.1, 0.3]
        // 水体物理参数
        transparency: 0.85,
        reflectance: 0.8,
        refractiveIndex: 1.33,
        // 水深模型参数
        depthModel: 2,
        maxDepth: 50.0,
        minDepth: 1.0,
        depthCenter: [0, 0],
        depthFalloff: 1.5,
        // 光照参数
        lightColor: [0.9, 0.9, 0.9],
        lightPos: [2, 2, 2],
        lightDir: [0.3, -0.7, 0.2],
        specularPower: 2.0,
        fresnelPower: 5.0,

        // 覆盖默认参数
        ...waterColorParams,

        // Gerstner波控制参数
        // waves: [...realisticOcean],
        waves: [...calm, ...moderate, ...rough],
        waveCount: 8
      } as GerstnerWaveMaterialParams
    }
  }
}
