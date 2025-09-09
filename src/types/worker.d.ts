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
