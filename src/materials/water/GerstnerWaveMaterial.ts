import { Uniforms, UniformType } from '@/materials/types/Material'
import { Material } from '../Material'
import { GERSTNER_WAVE_MATERIAL_DEFAULTS } from './_config/defaults'
import { GerstnerWaveMaterialConfig } from './types/GerstnerWaveMaterialConfig'

export class GerstnerWaveMaterial extends Material {
  constructor(label: string, config: GerstnerWaveMaterialConfig) {
    const p: Required<GerstnerWaveMaterialConfig> = {
      ...GERSTNER_WAVE_MATERIAL_DEFAULTS,
      ...config
    }

    // WebGL1.0 的 shader 中不允许存在成员数量不确定（即为变量）的数组，因此 uniform GerstnerWave uWaves[8]; 的长度被固定为 8
    const actualCount = Math.min(p.waveCount, p.waves.length, 8)
    if (p.waveCount !== p.waves.length) {
      console.warn(
        `[GerstnerWaveMaterial] waveCount(${p.waveCount}) !== waves.length(${p.waves.length}), ` +
          `using ${actualCount} waves`
      )
    }

    const uniforms: Uniforms = {
      // 波浪数量
      uWaveCount: {
        type: UniformType.ONE_I,
        value: actualCount
      }
    }

    // 波浪参数数组 - 需要分别设置每个波的各个属性
    for (let i = 0; i < actualCount; i++) {
      const wave = p.waves[i]!

      uniforms[`uWaves[${i}].direction`] = {
        type: UniformType.TWO_FV,
        value: new Float32Array(wave.direction)
      }
      uniforms[`uWaves[${i}].steepness`] = {
        type: UniformType.ONE_F,
        value: wave.steepness
      }
      uniforms[`uWaves[${i}].wavelength`] = {
        type: UniformType.ONE_F,
        value: wave.wavelength
      }
      uniforms[`uWaves[${i}].speedMultiplier`] = {
        type: UniformType.ONE_F,
        value: wave.speedMultiplier
      }
      uniforms[`uWaves[${i}].phase`] = {
        type: UniformType.ONE_F,
        value: wave.phase ?? 0
      }
    }
    super(label, uniforms)
  }
}
