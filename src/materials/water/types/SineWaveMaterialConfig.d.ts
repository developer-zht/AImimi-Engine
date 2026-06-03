import { WaterMaterialConfig } from './WaterMaterialConfig'

/** Sine Wave 特有参数 */
export interface SineWaveMaterialConfig extends WaterMaterialConfig {
  amplitude?: number
  waveVector?: [number, number]
  angularFrequency?: number
}
