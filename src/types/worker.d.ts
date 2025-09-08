type SpatialKeys =
  | 'serializedSpectrum'
  | 'serializedHeightSpectrum'
  | 'serializedSlopeXSpectrum'
  | 'serializedSlopeZSpectrum'
  | 'serializedDispXSpectrum'
  | 'serializedDispZSpectrum'

// Web Worker 无法直接传类实例
// 因此该 interface 定义无效
// interface FFTWorkerBasicMessage {
//   fftProcessor: FFTProcessor
// }

type serializedSpectrum = {
  real: number
  imag: number
}[][]

export type FFTWorkerMessage = {
  [key in SpatialKeys]?: serializedSpectrum
}

export interface SerializedSpectrum {
  realArray: Float32Array
  imagArray: Float32Array
  dimension: {
    rows: number
    cols: number
  }
}

export interface SerializedSpatial {
  realArray: Float32Array
  imagArray: Float32Array
  dimension: {
    rows: number
    cols: number
  }
}
