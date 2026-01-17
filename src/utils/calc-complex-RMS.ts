import { Complex } from '@/math/Complex'

export function computeRMS(field: Complex[][]): number {
  const N = field.length
  let sumSq = 0
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const mag2 = field[i][j].real ** 2 + field[i][j].imag ** 2
      sumSq += mag2
    }
  }
  return Math.sqrt(sumSq / (N * N))
}
