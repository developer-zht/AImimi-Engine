import { FFTProcessor } from '@/math/FFTProcessor'

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

function testFFT1D() {
  const fft = new FFTProcessor()

  // 输入信号
  const signal = [1, 2, 3, 4]
  console.log('Input:', signal)

  // 正向 FFT
  const spectrum = fft.fft1DInterface(signal)
  console.log(
    'Spectrum:',
    spectrum.map((c) => `(${c.real.toFixed(3)}, ${c.imag.toFixed(3)})`)
  )

  // 逆向 IFFT
  const reconstructed = fft.ifft1DInterface(spectrum).map((c) => c.real)
  console.log('Reconstructed:', reconstructed)

  // 验证
  if (arraysAlmostEqual(signal, reconstructed)) {
    console.log('✅ 1D FFT/IFFT 测试通过')
  } else {
    console.error('❌ 1D FFT/IFFT 测试失败')
  }
}

function testFFT2D() {
  const fft = new FFTProcessor()

  // 输入信号（2D 方阵）
  const matrix = [
    [1, 2],
    [3, 4]
  ]
  console.log('Input Matrix:', matrix)

  // 正向 FFT
  const spectrum = fft.fft2DInterface(matrix)
  console.log(
    'Spectrum:',
    spectrum.map((row) => row.map((c) => `(${c.real.toFixed(3)}, ${c.imag.toFixed(3)})`))
  )

  // 逆向 IFFT
  const reconstructed = fft.ifft2DInterface(spectrum).map((row) => row.map((c) => c.real))
  console.log('Reconstructed Matrix:', reconstructed)

  // 验证
  const flatOriginal = matrix.flat()
  const flatReconstructed = reconstructed.flat()
  if (arraysAlmostEqual(flatOriginal, flatReconstructed)) {
    console.log('✅ 2D FFT/IFFT 测试通过')
  } else {
    console.error('❌ 2D FFT/IFFT 测试失败')
  }
}

// 执行测试
testFFT1D()
testFFT2D()
