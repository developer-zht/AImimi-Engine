import { Complex } from '@/math/Complex'
import { SerializedSpatial, SerializedSpectrum } from '@/types/worker'

// Transferable Objects
export function serializeSpectrumToArrays(spectrum: Complex[][]): SerializedSpectrum {
  const rows = spectrum.length
  const cols = spectrum[0].length
  const realArray = new Float32Array(rows * cols)
  const imagArray = new Float32Array(rows * cols)

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const index = i * cols + j
      realArray[index] = spectrum[i][j].real
      imagArray[index] = spectrum[i][j].imag
    }
  }

  return { realArray, imagArray, dimension: { rows, cols } }
}

export function deserializeArraysToSpectrum(
  realArray: Float32Array,
  imagArray: Float32Array,
  dimension: { rows: number; cols: number }
): Complex[][] {
  const { rows, cols } = dimension
  const spectrum: Complex[][] = new Array(rows).fill(null).map(() => new Array(cols).fill(null))

  for (let i = 0; i < dimension.rows; i++) {
    for (let j = 0; j < dimension.cols; j++) {
      const index = i * cols + j
      spectrum[i][j] = new Complex(realArray[index], imagArray[index])
    }
  }

  return spectrum
}

export function serializeSpatialToArrays(spatial: Complex[][]): SerializedSpatial {
  const rows = spatial.length
  const cols = spatial[0].length
  const realArray = new Float32Array(rows * cols)
  const imagArray = new Float32Array(rows * cols)

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const index = i * cols + j
      realArray[index] = spatial[i][j].real
      imagArray[index] = spatial[i][j].imag
    }
  }

  return { realArray, imagArray, dimension: { rows, cols } }
}

export function deserializeArraysToSpatial(
  realArray: Float32Array,
  imagArray: Float32Array,
  dimension: { rows: number; cols: number }
): Complex[][] {
  const { rows, cols } = dimension
  const spectrum: Complex[][] = new Array(rows).fill(null).map(() => new Array(cols).fill(null))

  for (let i = 0; i < dimension.rows; i++) {
    for (let j = 0; j < dimension.cols; j++) {
      const index = i * cols + j
      spectrum[i][j] = new Complex(realArray[index], imagArray[index])
    }
  }

  return spectrum
}
