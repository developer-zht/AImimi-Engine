import { FFTProcessor } from '@/math/FFTProcessor/FFTProcessor'
import { describe, expect, it } from 'vitest'

// 辅助函数：检查两个数组是否近似相等
function arraysAlmostEqual(a: number[], b: number[], tol: number = 1e-6): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > tol) {
      console.error(`Mismatch at index ${i}: expected ${a[i]}, got ${b[i]}`)
      return false
    }
  }
  return true
}

describe('FFTProcessor', () => {
  const fftProcessor = new FFTProcessor()

  describe('1D FFT/IFFT', () => {
    it('should correctly reconstruct the original 1D signal', () => {
      const signal = [1, 2, 3, 4]

      // 正向 FFT
      const spectrum = fftProcessor.fft1DInterface(signal)

      // 逆向 IFFT
      const reconstructed = fftProcessor.ifft1DInterface(spectrum).map((c) => c.real)

      // 断言
      expect(arraysAlmostEqual(signal, reconstructed)).toBe(true)
    })
  })

  describe('2D FFT/IFFT', () => {
    it('should correctly reconstruct the original 2D matrix', () => {
      // 输入信号（2D 方阵）
      const matrix = [
        [1, 2],
        [3, 4]
      ]

      // 正向 FFT
      const spectrum = fftProcessor.fft2DInterface(matrix)

      // 逆向 IFFT
      const reconstructed = fftProcessor
        .ifft2DInterface(spectrum)
        .map((row) => row.map((c) => c.real))

      // 扁平化比较
      const flatOriginal = matrix.flat()
      const flatReconstructed = reconstructed.flat()

      expect(arraysAlmostEqual(flatOriginal, flatReconstructed)).toBe(true)
    })
  })
})
