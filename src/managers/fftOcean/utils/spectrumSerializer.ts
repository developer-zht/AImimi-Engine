import { Complex } from '@/math/Complex'
import { SerializedSpatial, SerializedSpectrum } from '@/types/worker'

/**
 * Worker.postMessage() 走的是 结构化克隆算法 (structured clone algorithm)。
 * ✅ 可以传递：
 * 基础类型（number, string, boolean, null, undefined）
 * 原生对象（Object, Array, Map, Set, Date, RegExp, Blob, File, ImageData 等）
 * TypedArray / ArrayBuffer（非常常用，因为跨线程可转移 zero-copy）可转移对象（Transferable，例如 ArrayBuffer、MessagePort）
 * ❌ 不可以传递：
 * 含有函数、class 实例的方法（会丢失）
 * DOM 节点
 * 原型链复杂的对象（只能克隆数据部分，方法消失）
 *
 *
 */

// 给 spectrum:Complex[][] 进行编码，生成包含 Float32Array 的对象
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

// 对包含 Float32Array 的对象解码，使之转换成 spectrum:Complex[][]
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

// 给 IFFT 计算所得的 spatial:Complex[][] 进行编码，生成包含 Float32Array 的对象
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

// 对包含 Float32Array 的对象解码，使之转换成 spatial:Complex[][]
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
