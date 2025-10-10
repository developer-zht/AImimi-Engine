import { CascadeLayerParams } from '@/types/fftOcean'
import { Spectrum } from '@/managers/fftOcean/spectrums/Spectrum'
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
  generateSineWaveH0Spectrum(size: number) {
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
  computeHktFromH0Spectrum(time: number, L: number): Complex[][] {
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

/**
 * 测试用：生成单个正弦波的 h0 和 h0Conj
 * 用于验证 calculateSingleLayerAmplitudeAtTime 的正确性
 */
export class TestSineWaveSpectrum {
  private resolution: number

  private h0: Complex[][]
  private h0Conj: Complex[][]

  /**
   * 初始化函数
   * @param N 分辨率
   */
  constructor(resolution: number) {
    this.resolution = resolution

    const h0: Complex[][] = Array(resolution)
      .fill(null)
      .map(() =>
        Array(resolution)
          .fill(null)
          .map(() => new Complex(0, 0))
      )

    this.h0 = h0

    const h0Conj: Complex[][] = Array(resolution)
      .fill(null)
      .map(() =>
        Array(resolution)
          .fill(null)
          .map(() => new Complex(0, 0))
      )

    this.h0Conj = h0Conj

    this.generateTestH0andH0Conj({
      frequency: 2,
      direction: 'horizontal',
      amplitude: resolution * resolution * 0.05 // 合适的振幅
    })
  }
  /**
   * 生成测试用的 h0 和 h0Conj
   * @param N 分辨率
   * @param L 物理尺寸
   * @param waveConfig 波浪配置
   */
  generateTestH0andH0Conj(
    // N: number,
    // L: number,
    waveConfig: {
      frequency: number // 频率（几个波长）
      direction: 'horizontal' | 'vertical' // 方向
      amplitude: number // 振幅
    }
  ) {
    const N = this.resolution
    const freq = waveConfig.frequency
    const amp = waveConfig.amplitude

    // 根据方向设置频率位置
    let n_pos: number, m_pos: number
    if (waveConfig.direction === 'horizontal') {
      // 水平波：沿 y 方向变化
      n_pos = 3
      m_pos = freq
    } else {
      // 垂直波：沿 x 方向变化
      n_pos = freq
      m_pos = 0
    }

    // 设置包含虚部的复数频谱
    const h0_k = new Complex(amp, 1) // h₀(k) = amp + i
    const h0_minus_k = h0_k.conjugate() // h₀(-k) 必须是 h₀*(k) 的共轭 = amp - i

    // 设置正频率和负频率（实信号的共轭对称性）
    // h0(k)
    this.h0[n_pos][m_pos] = h0_k
    this.h0[N - n_pos][N - m_pos] = h0_minus_k

    // h0Conj(-k) = h0*(k)
    // 对于我们设置的实数 h0，共轭就是它自己
    this.h0Conj[n_pos][m_pos] = h0_minus_k.conjugate() // h₀*(k) = amp - i
    this.h0Conj[N - n_pos][N - m_pos] = h0_k.conjugate() // h₀*(-k) = amp + i

    return {
      h0: this.h0,
      h0Conj: this.h0Conj
    }
  }

  getH0andH0Conj() {
    return {
      h0: this.h0,
      h0Conj: this.h0Conj
    }
  }

  /**
   * 打印 h0 的非零元素，用于调试
   */
  static printH0NonZero(h0: Complex[][], name: string = 'h0') {
    console.log(`\n=== ${name} 非零元素 ===`)
    let count = 0
    for (let m = 0; m < h0.length; m++) {
      for (let n = 0; n < h0[m].length; n++) {
        const mag = h0[m][n].magnitude()
        if (mag > 0.0001) {
          console.log(
            `${name}[${m}][${n}] = ${h0[m][n].real.toFixed(3)} + ${h0[m][n].imag.toFixed(3)}i, mag=${mag.toFixed(3)}`
          )
          count++
        }
      }
    }
    console.log(`非零元素数量: ${count}`)
  }
}
