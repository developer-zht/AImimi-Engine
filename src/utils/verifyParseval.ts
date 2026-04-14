import { Complex } from '@/math/Complex'

export function verifyParseval(
  spatial: Complex[][],
  spectrum: Complex[][]
): { ok: boolean; ratio: number } {
  const N = spatial.length

  let energySpatial = 0
  let energySpectrum = 0

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      energySpatial += spatial[i][j].real ** 2 + spatial[i][j].imag ** 2
      energySpectrum += spectrum[i][j].real ** 2 + spectrum[i][j].imag ** 2
    }
  }

  // Parseval 定理: Σ|x|² = (1/N²) Σ|X|²
  const lhs = energySpatial
  const rhs = energySpectrum / (N * N)

  return {
    ok: Math.abs(lhs - rhs) / lhs < 1e-12, // 相对误差足够小
    ratio: Math.sqrt(energySpectrum / (N * N * N * N)) / Math.sqrt(energySpatial / (N * N)) // 频域RMS/时域RMS ≈ 1
  }
}
