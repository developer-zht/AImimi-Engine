// import { CascadeLayerParams } from '@/managers/fftOcean/types/fftOcean'
import { OceanParams } from '../fft/types/OceanParams'

// export interface Spectrum {
//   calculateH0Magnitude(kx: number, kz: number, params: CascadeLayerParams): number
// }

/**
 * 波谱接口
 *
 * 所有波谱模型（Phillips、JONSWAP、Capillary 等）的统一接口。
 * 由 InitialSpectrum 在生成 h₀(k) 时调用。
 *
 * @param kx - 波向量 x 分量 (rad/m)
 * @param kz - 波向量 z 分量 (rad/m)
 * @param params - 海洋参数
 * @returns h₀ 的幅度 |h₀(k)|，不含随机相位
 */
export interface Spectrum {
  calculateH0Magnitude(kx: number, kz: number, params: OceanParams): number
}
