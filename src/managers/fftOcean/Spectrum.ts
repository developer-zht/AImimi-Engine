import { CascadeLayerParams, OceanParams } from '@/types/fftOcean'

export interface Spectrum {
  calculateH0Magnitude(kx: number, kz: number, params: CascadeLayerParams): number
}
