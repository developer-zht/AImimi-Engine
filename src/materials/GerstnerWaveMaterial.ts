import { getShaderString } from '@/loaders/loadShader'
import { WaterMaterial, WaterMaterialParams } from '@/materials/WaterMaterial'
import { Uniforms } from '@/types/Material'
import { Vec2 } from '@/types/math'

export interface GerstnerWaveParams {
  direction: Vec2 // 波浪传播方向
  steepness: number // 陡峭度
  wavelength: number // 波长
  speedMultiplier: number // 速度倍数
  phase?: number // 相位偏移
}

export interface GerstnerWaveMaterialParams extends WaterMaterialParams {
  waves: GerstnerWaveParams[] // 波浪数组，最多8个
  waveCount?: number // 实际使用的波浪数量，如果不指定则使用waves.length
}

export class GerstnerWaveMaterial extends WaterMaterial {
  constructor(
    gerstnerWaveMaterialParams: GerstnerWaveMaterialParams,
    vertexShaderContent: string,
    fragmentShaderContent: string
  ) {
    if (
      gerstnerWaveMaterialParams.waves &&
      gerstnerWaveMaterialParams.waves.length &&
      gerstnerWaveMaterialParams.waves.length > 8
    ) {
      gerstnerWaveMaterialParams.waves = gerstnerWaveMaterialParams.waves.slice(0, 8)
      gerstnerWaveMaterialParams.waveCount = 8
    }

    // 设置默认参数
    let defaultGerstnereMaterialWaveParams: GerstnerWaveMaterialParams = {
      // 纹理使用标志
      useDiffuseMap: 0,
      useNormalMap: 0,
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
      // 波浪控制参数
      time: 0.0,
      // 光照参数
      specularPower: 32.0,
      fresnelPower: 5.0,

      // Gestner Wave 属性
      waves: [
        {
          direction: [1.0, 0.0],
          steepness: 0.3,
          wavelength: 10.0,
          speedMultiplier: 1.0,
          phase: 0.0
        }
      ],
      waveCount: 1
      // ...gerstnerWaveMaterialParams
    }

    defaultGerstnereMaterialWaveParams = {
      ...defaultGerstnereMaterialWaveParams,
      // 作用：覆盖默认值
      ...gerstnerWaveMaterialParams
    }

    const gerstnerWaveUniforms: Uniforms = {
      // 波浪参数数组 - 需要分别设置每个波的各个属性
      // 波浪数量
      uWaveCount: { type: '1i', value: defaultGerstnereMaterialWaveParams.waveCount }
    }

    for (let i = 0; i < defaultGerstnereMaterialWaveParams.waveCount; i++) {
      const wave = defaultGerstnereMaterialWaveParams.waves[i]

      gerstnerWaveUniforms[`uWaves[${i}].direction`] = {
        type: '2fv',
        value: new Float32Array(wave.direction)
        // value: wave.direction
      }
      gerstnerWaveUniforms[`uWaves[${i}].steepness`] = {
        type: '1f',
        value: wave.steepness
      }
      gerstnerWaveUniforms[`uWaves[${i}].wavelength`] = {
        type: '1f',
        value: wave.wavelength
      }
      gerstnerWaveUniforms[`uWaves[${i}].speedMultiplier`] = {
        type: '1f',
        value: wave.speedMultiplier
      }
      gerstnerWaveUniforms[`uWaves[${i}].phase`] = {
        type: '1f',
        value: wave.phase
      }
    }

    // console.log(gerstnerWaveUniforms)

    super(
      defaultGerstnereMaterialWaveParams,
      vertexShaderContent,
      fragmentShaderContent,
      gerstnerWaveUniforms
    )
  }
}

export async function buildGerstnerWaveMaterial(
  gerstnerWaveMaterialParams: GerstnerWaveMaterialParams,
  vertexPath: string,
  fragmentPath: string
): Promise<GerstnerWaveMaterial> {
  let vertexShaderContent = await getShaderString(vertexPath)
  let fragmentShaderContent = await getShaderString(fragmentPath)

  return new GerstnerWaveMaterial(
    gerstnerWaveMaterialParams,
    vertexShaderContent,
    fragmentShaderContent
  )
}
