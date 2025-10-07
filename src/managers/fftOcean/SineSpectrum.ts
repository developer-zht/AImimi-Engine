import { CascadeLayerParams, OceanParams } from '@/types/fftOcean'
import { Spectrum } from './Spectrum'
import { Complex } from '@/math/Complex'

export class SineSpectrum implements Spectrum {
  private spectrum: Complex[][]

  constructor() {}

  /**
   * 计算正弦波的 h0 幅度（不含随机数和共轭）
   * @param k 波数向量 {x, y}
   * @param amplitude 波的振幅（单位：米）
   * @returns h0 的幅度
   */
  calculateH0Magnitude(kx: number, kz: number, params: CascadeLayerParams): number {
    const kMag = Math.sqrt(kx * kx + kz * kz)

    // 避免除零
    if (kMag < 0.00001) {
      return 0
    }

    // 正弦波的 h0 就是振幅本身
    // 在频域中，单个正弦波就是一个 delta 函数
    return params.amplitude
  }

  // Height Spectrum => t = 0
  generateSineWaveH0(size: number) {
    const spectrum: Complex[][] = []

    for (let m = 0; m < size; m++) {
      const row: Complex[] = []
      for (let n = 0; n < size; n++) {
        row.push(new Complex(0, 0))
      }
      spectrum.push(row)
    }

    const amplitude = size * size * 0.05
    const freq = 2

    // 只设置一个方向的频率
    spectrum[0][freq] = new Complex(amplitude, 0)
    spectrum[0][size - freq] = new Complex(amplitude, 0)

    this.spectrum = spectrum
  }

  // Height Spectrum(h_k_t) => t = t0
  computeHktFromH0(time: number, L: number): Complex[][] {
    const h0Spectrum = this.spectrum
    const size = h0Spectrum.length
    const hkt: Complex[][] = []
    const gravity = 9.81

    for (let m = 0; m < size; m++) {
      const row: Complex[] = []

      for (let n = 0; n < size; n++) {
        const kx = (2 * Math.PI * n) / L
        const kz = (2 * Math.PI * m) / L
        const k = Math.sqrt(kx * kx + kz * kz)

        if (k < 0.00001) {
          row.push(new Complex(0, 0))
          continue
        }

        // 色散关系
        const omega = Math.sqrt(gravity * k)
        const phase = omega * time

        // h(k,t) = h0(k) * e^(i*omega*t)
        // 当 t=0 时，e^(i*0) = 1，所以 h(k,0) = h0(k)
        const cosPhase = Math.cos(phase)
        const sinPhase = Math.sin(phase)

        const h0_k = h0Spectrum[m][n]

        const hkt_real = h0_k.real * cosPhase - h0_k.imag * sinPhase
        const hkt_imag = h0_k.real * sinPhase + h0_k.imag * cosPhase

        row.push(new Complex(hkt_real, hkt_imag))
      }

      hkt.push(row)
    }

    // 在 computeHktFromH0 中添加
    console.log('=== H0 频谱统计 ===')
    let h0Count = 0
    let h0Max = 0
    for (let m = 0; m < size; m++) {
      for (let n = 0; n < size; n++) {
        const mag = h0Spectrum[m][n].magnitude()
        if (mag > 0.001) {
          h0Count++
          h0Max = Math.max(h0Max, mag)
          console.log(
            `h0[${m}][${n}] = ${h0Spectrum[m][n].real.toFixed(3)} + ${h0Spectrum[m][n].imag.toFixed(3)}i, mag=${mag.toFixed(3)}`
          )
        }
      }
    }
    console.log(`非零元素数量: ${h0Count}`)
    console.log(`最大幅度: ${h0Max}`)

    console.log('\n=== H(k,t) 频谱统计 ===')
    let hktCount = 0
    let hktMax = 0
    for (let m = 0; m < size; m++) {
      for (let n = 0; n < size; n++) {
        const mag = Math.sqrt(hkt[m][n].real ** 2 + hkt[m][n].imag ** 2)
        if (mag > 0.001) {
          hktCount++
          hktMax = Math.max(hktMax, mag)
        }
      }
    }
    console.log(`非零元素数量: ${hktCount}`)
    console.log(`最大幅度: ${hktMax}`)

    return hkt
  }
}
