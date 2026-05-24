import { Uniforms, UniformType } from '@/materials/types/Material'
import { Material } from '../Material'
import { SineWaveMaterialConfig } from './types/SineWaveMaterialConfig'
import { SINE_WAVE_MATERIAL_DEFAULTS } from './_config/defaults'

// 正弦波水体材质类
export class SineWaveMaterial extends Material {
  constructor(label: string, config: SineWaveMaterialConfig) {
    const p: Required<SineWaveMaterialConfig> = { ...SINE_WAVE_MATERIAL_DEFAULTS, ...config }

    // 构建正弦波特有的 uniforms
    const uniforms: Uniforms = {
      // 正弦波基础参数
      uAmplitude: { type: UniformType.ONE_F, value: p.amplitude }, // A
      uWaveVector: { type: UniformType.TWO_FV, value: p.waveVector }, // k
      uAngularFreq: { type: UniformType.ONE_F, value: p.angularFrequency } // ω
    }

    super(label, uniforms)
  }
}
