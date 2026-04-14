import { Complex } from '@/math/Complex'
import { CascadeLayerParams } from '@/types/fftOcean'
import { Spectrum } from '@/managers/fftOcean/spectrums/Spectrum'

export class CascadeLayerData {
  private cascadeLayerParams: CascadeLayerParams
  private spectrum: Spectrum

  // 初始振幅谱
  private h0: Complex[][]
  private h0Conj: Complex[][]

  private kmax: number

  constructor(cascadeLayerParams: CascadeLayerParams, spectrum: Spectrum) {
    this.cascadeLayerParams = cascadeLayerParams
    this.spectrum = spectrum

    // 为这一层生成独立的初始谱
    this.generateInitialSpectrum()
  }

  /**
   * 将频率索引转换为波数 k
   * - index < N/2 → 正频率
   * - index >= N/2 → 负频率
   * - k = 2π * n / L
   */
  private getWaveNumber(index: number, N: number, L: number): number {
    // index < N/2 为正频率，>= N/2 为负频率
    const n = index < N / 2 ? index : index - N
    return (2 * Math.PI * n) / L
  }

  /**
   * 高斯随机数生成器(Box–Muller 变换)
   */
  private gaussianRandom(): number {
    let u1 = 0,
      u2 = 0
    while (u1 === 0) u1 = Math.random()
    while (u2 === 0) u2 = Math.random()
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
  }

  /**
   * 基于 Phillips 波谱 和 FFT 的海面生成器
   *
   * 核心物理模型：
   * 1. 初始振幅谱：
   *    h0(k) = sqrt(P(k) / 2) * (xi_r + i * xi_i)
   *    - P(k)：Phillips 波谱值
   *    - xi_r, xi_i：高斯随机数（均值0，方差1）
   *
   * 2. 色散关系（深水波）：
   *    ω = sqrt(g * |k|)
   *
   * 3. 时间演化：
   *    h(k, t) = h0(k) * exp(i * omega * t) + conj(h0(-k)) * exp(-i * omega * t)
   *    - 保证结果为实数场（共轭对称性）
   *
   * 4. 空间域转换：
   *    η(x, t) = IFFT2(h(k, t))
   *
   * 5. 派生量：
   *    - 法线（斜率）：slope_x = h(k, t) * (i * kx)
   *    - 位移（choppy waves）：
   *      disp_x = h(k, t) * (-i * kx / |k| * choppiness)
   *
   * 实现细节
   * - getWaveNumber：处理 FFT 索引到实际波数的映射
   * - gaussianRandom：Box-Muller 方法生成高斯分布随机数
   * - generateInitialSpectrum：构造符合波谱的初始频域波场
   * - update：每帧计算频域演化 -> IFFT -> 空间域高度 / 位移 / 法线
   */

  /**
   * 生成初始振幅谱 h0(k)
   * - h0(k) 是初始时刻的复振幅谱，统计特性由 Phillips 波谱 P(k) 给出
   * - 公式：h0(k) = sqrt(P(k) / 2) * (xi_r + i * xi_i)
   * - 随机相位来自高斯分布 xi_r, xi_i ~ N(0,1)
   */
  private generateInitialSpectrum(): void {
    const N = this.cascadeLayerParams.resolution // 海浪分辨率（vertex 的密度）
    const L = this.cascadeLayerParams.size // 海浪尺寸
    const half = N / 2 // 处理 Nyquist 频率所需的频点
    const deltaK = (2 * Math.PI) / L // 波数网格间距

    // Debug Code
    const kValues: number[] = []
    const h0Magnitudes: number[] = []

    this.h0 = Array(N)
      .fill(null)
      .map(() => Array(N))
    this.h0Conj = Array(N)
      .fill(null)
      .map(() => Array(N))

    for (let n = 0; n < N; n++) {
      for (let m = 0; m < N; m++) {
        // 计算波向量 kx, kz
        // kx = 2π * n' / L 需要通过判断 n 与 N/2 的大小关系来决定 n' 的取值，因此 n' 可为负
        const kx = this.getWaveNumber(n, N, L)
        const kz = this.getWaveNumber(m, N, L)
        const k = Math.sqrt(kx * kx + kz * kz)

        // Debug Code
        if (k > 0.001) {
          // 排除DC分量
          kValues.push(k)

          // 计算h0
          const h0Mag = this.spectrum.calculateH0Magnitude(kx, kz, this.cascadeLayerParams)
          h0Magnitudes.push(h0Mag)
        }

        // DC 分量必须为 0
        if (n === 0 && m === 0) {
          this.h0[n][m] = new Complex(0, 0)
          continue
        }

        // 波谱
        const h0Magnitude = this.spectrum.calculateH0Magnitude(kx, kz, this.cascadeLayerParams)
        // 高斯随机数
        const xi_r = this.gaussianRandom()
        const xi_i = this.gaussianRandom()

        // Nyquist 频率必须是纯实数
        const isNyquist =
          (n === 0 && m === half) || // kx=0, kz=Nyquist
          (n === half && m === 0) || // kx=Nyquist, kz=0
          (n === half && m === half) // kx=Nyquist, kz=Nyquist

        if (isNyquist) {
          // 只使用实部，虚部设为 0
          this.h0[n][m] = new Complex(h0Magnitude * xi_r, 0)
        } else {
          // 正常生成
          this.h0[n][m] = new Complex(h0Magnitude * xi_r, h0Magnitude * xi_i)
        }

        this.h0[n][m] = new Complex(h0Magnitude * xi_r, h0Magnitude * xi_i)
      }
    }

    /**
     * Debug Code
     * 统计分析
     * 检查 h0 是否非零
     */
    console.log(`h0[${N / 2}][${N / 2}]:`, {
      real: this.h0[N / 2][N / 2].real.toExponential(),
      imag: this.h0[N / 2][N / 2].imag
    })
    console.log('=== k值统计 ===')
    console.log('k_min:', Math.min(...kValues))
    console.log('k_max:', Math.max(...kValues))
    console.log('k_avg:', kValues.reduce((a, b) => a + b) / kValues.length)

    console.log('=== h0值统计 ===')
    console.log('h0_min:', Math.min(...h0Magnitudes))
    console.log('h0_max:', Math.max(...h0Magnitudes))
    console.log('h0_avg:', h0Magnitudes.reduce((a, b) => a + b) / h0Magnitudes.length)
    console.log('非零h0数量:', h0Magnitudes.filter((v) => v > 0.0001).length)

    this.kmax = Math.max(...kValues)

    // 第二次循环：计算 h0Conj
    for (let n = 0; n < N; n++) {
      for (let m = 0; m < N; m++) {
        // 确保实数输出的共轭对称性 h₀(-k) = h₀*(k)
        // 特殊处理 DC 分量
        if (n === 0 && m === 0) {
          this.h0Conj[n][m] = new Complex(0, 0)
          continue
        }
        const n_conj = n === 0 ? 0 : N - n
        const m_conj = m === 0 ? 0 : N - m

        this.h0Conj[n][m] = new Complex(this.h0[n_conj][m_conj].real, -this.h0[n_conj][m_conj].imag)
      }
    }
  }

  // getter
  getH0AndH0Conj() {
    return { h0: this.h0, h0Conj: this.h0Conj }
  }

  getCascadeLayerParams(): CascadeLayerParams {
    return this.cascadeLayerParams
  }

  getKMax() {
    return this.kmax
  }
}
