import { Complex } from '@/math/Complex'

/**
 * 9 个频域谱，每帧由 RealtimeSpectrum 生成，
 * 送入 FFTOceanTextureManager 做 GPU IFFT
 */
export interface OceanSpectrumData {
  height: Complex[][]
  dispX: Complex[][]
  dispZ: Complex[][]
  slopeX: Complex[][]
  slopeZ: Complex[][]
  dDx_dx: Complex[][]
  dDz_dz: Complex[][]
  dDx_dz: Complex[][]
  dDz_dx: Complex[][]
}
