import { FFTProcessor } from '@/math/FFTProcessor'
import { Complex } from '@/math/Complex'
import { PhillipsSpectrum, OceanParams } from '@/managers/fftOcean/PhillipsSpectrum'
import { SerializedSpatial } from '@/types/worker'
import { deserializeArraysToSpatial, serializeSpectrumToArrays } from './utils/spectrumSerializer'

export class FFTOceanGenerator {
  private fftProcessor: FFTProcessor
  private params: OceanParams
  private spectrum: PhillipsSpectrum

  // 初始振幅谱
  private h0: Complex[][]
  private h0Conj: Complex[][]

  // 输出数据
  private heightField: Float32Array // 海面高度 η(x,t)
  private displacementX: Float32Array // X 方向水平位移
  private displacementZ: Float32Array // Z 方向水平位移
  private normalX: Float32Array // 法线的 X 分量 (∂η/∂x)
  private normalZ: Float32Array // 法线的 Z 分量 (∂η/∂z)

  private workers: Map<string, Worker> = new Map()
  private workerPromises: Map<
    string,
    { resolve: (complex: Complex[][]) => void; reject: (event: ErrorEvent) => void }
  > = new Map()

  constructor(params: OceanParams) {
    this.fftProcessor = new FFTProcessor()
    this.params = params
    this.spectrum = new PhillipsSpectrum()

    const N = params.resolution
    this.heightField = new Float32Array(N * N)
    this.displacementX = new Float32Array(N * N)
    this.displacementZ = new Float32Array(N * N)
    this.normalX = new Float32Array(N * N)
    this.normalZ = new Float32Array(N * N)

    this.generateInitialSpectrum()

    // 初始化 woker
    this.initializeWorkers()
  }

  // 创建计算 IFFT 的 worker 的通用方法
  private createWorker(name: string, scriptPath: string): Worker {
    const worker = new Worker(new URL(scriptPath, import.meta.url), {
      type: 'module'
    })

    worker.addEventListener('message', (event: MessageEvent<SerializedSpatial>) => {
      const promise = this.workerPromises.get(name)
      if (promise) {
        const { realArray, imagArray, dimension } = event.data
        const spatial = deserializeArraysToSpatial(realArray, imagArray, dimension)
        promise.resolve(spatial)
        this.workerPromises.delete(name)
      }
    })

    worker.addEventListener('error', (event: ErrorEvent) => {
      const promise = this.workerPromises.get(name)
      if (promise) {
        promise.reject(event)
        this.workerPromises.delete(name)
      }
    })

    return worker
  }

  // 创建一组计算 IFFT 的 worker
  private initializeWorkers() {
    this.workers.set('slopeX', this.createWorker('slopeX', './workers/CalcSlopeXSpatial.ts'))
    this.workers.set('slopeZ', this.createWorker('slopeZ', './workers/CalcSlopeZSpatial.ts'))
    this.workers.set('dispX', this.createWorker('dispX', './workers/CalcDispXSpatial.ts'))
    this.workers.set('dispZ', this.createWorker('dispZ', './workers/CalcDispZSpatial.ts'))
  }

  // 对单个 worker 的计算行为进行封装
  private computeInWorker(name: string, spectrum: Complex[][]): Promise<Complex[][]> {
    return new Promise((resolve, reject) => {
      const worker = this.workers.get(name)

      if (!worker) {
        reject(new Error('Worker not initialized'))
        return
      }

      this.workerPromises.set(name, { resolve, reject })

      // 因为 postMessage 的参数类型有限
      // 因此将 spectrum: Complex[][] 转换成包含 Float32Array 的对象以便 postMessage 传输
      const serializedSpectrum = serializeSpectrumToArrays(spectrum)

      worker.postMessage(serializedSpectrum)
    })
  }

  // 使用 Promise.all 同步处理 IFFT 计算的结果
  private async computeInWorkers(spectrums: {
    slopeXSpectrum: Complex[][]
    slopeZSpectrum: Complex[][]
    dispXSpectrum: Complex[][]
    dispZSpectrum: Complex[][]
  }) {
    const slopeXSpatialPromise = this.computeInWorker('slopeX', spectrums.slopeXSpectrum)
    const slopeZSpatialPromise = this.computeInWorker('slopeZ', spectrums.slopeZSpectrum)
    const dispXSpatialPromise = this.computeInWorker('dispX', spectrums.dispXSpectrum)
    const dispZSpatialPromise = this.computeInWorker('dispZ', spectrums.dispZSpectrum)

    try {
      const results = await Promise.all([
        slopeXSpatialPromise,
        slopeZSpatialPromise,
        dispXSpatialPromise,
        dispZSpatialPromise
      ])

      const spatialData = {
        slopeXSpatial: results[0],
        slopeZSpatial: results[1],
        dispXSpatial: results[2],
        dispZSpatial: results[3]
      }

      return spatialData
    } catch (error) {
      console.log(error)
    }
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
    // if (Math.abs(n) < 0.001) {
    //   n = 0.001 * Math.sign(n) || 0.001 // 给一个小的非零值
    // }

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
    const N = this.params.resolution // 海浪分辨率（vertex 的密度）
    const L = this.params.size // 海浪尺寸

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

        // 跳过DC分量
        if (Math.abs(kx) < 0.001 && Math.abs(kz) < 0.001) {
          this.h0[n][m] = new Complex(0, 0)
          continue
        }

        // Phillips谱
        const P = Math.max(0.0, this.spectrum.calculate(kx, kz, this.params))

        // Debug Code
        // console.log(P)

        // 高斯随机数
        const xi_r = this.gaussianRandom()
        const xi_i = this.gaussianRandom()

        // h0(k) = sqrt(P/2) * (xi_r + i*xi_i)
        this.h0[n][m] = new Complex(Math.sqrt(P / 2) * xi_r, Math.sqrt(P / 2) * xi_i)
      }
    }

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

  /**
   * 更新海面状态到时间 t
   * 核心公式（频域时间演化）：
   * h(k,t) = h₀(k) * e^(i * ω * t) + h₀*^(-k) * e^(-i * ω * t)
   * 深水色散关系: ω(k) = sqrt(g * |k|)
   */
  async update(time: number): Promise<void> {
    const N = this.params.resolution
    const L = this.params.size

    /**
     * 初始化频域（k 空间）存储
     * heightSpectrum    : 高度场频谱 η̂(k, t)
     * slopeXSpectrum    : x 方向高度梯度频谱（用于法线）
     * slopeZSpectrum    : z 方向高度梯度频谱
     * dispXSpectrum     : x 方向水平位移频谱（choppy waves）
     * dispZSpectrum     : z 方向水平位移频谱
     */
    const heightSpectrum: Complex[][] = Array(N)
      .fill(null)
      .map(() => Array(N))
    const slopeXSpectrum: Complex[][] = Array(N)
      .fill(null)
      .map(() => Array(N))
    const slopeZSpectrum: Complex[][] = Array(N)
      .fill(null)
      .map(() => Array(N))
    const dispXSpectrum: Complex[][] = Array(N)
      .fill(null)
      .map(() => Array(N))
    const dispZSpectrum: Complex[][] = Array(N)
      .fill(null)
      .map(() => Array(N))

    for (let n = 0; n < N; n++) {
      for (let m = 0; m < N; m++) {
        /**
         * 频率向量 k = (k_x, k_z)
         * 公式：
         *   k_x = 2π (n - N/2) / L
         *   k_z = 2π (m - N/2) / L
         * 物理意义：波数（rad/m），控制波长 λ = 2π / |k|
         */
        const kx = this.getWaveNumber(n, N, L)
        const kz = this.getWaveNumber(m, N, L)
        const k = Math.sqrt(kx * kx + kz * kz)

        /**
         * 计算随时间演化的振幅谱 h(k, t)
         * 公式：
         *   h(k, t) = h₀(k) * e^(i * ω * t) + h₀*^(-k) * e^(-i * ω * t)
         * 其中 ω = sqrt(g |k|) （深水波色散关系）
         */
        const h_k_t = this.calculateAmplitudeAtTime(n, m, k, time)

        // 高度谱 η̂(k,t)
        heightSpectrum[n][m] = h_k_t

        /**
         * 梯度谱（不是梯度）：
         *   i * k_x * h(k, t)
         *   i * k_z * h(k, t)
         * 与梯度的关系：
         *   ∂η/∂x = IFFT( i * k_x * h(k, t) ) = Σ ik·h(k,t) · e^(ik_x * x)
         *   ∂η/∂z = IFFT( i * k_z * h(k, t) ) = Σ ik·h(k,t) · e^(ik_z * z)
         * 这里用 (0, k_x) 相当于乘以 i k_x
         */
        // const slopeScale = this.params.size / (2.0 * Math.PI)
        const slopeScale = 1
        // Debug Code
        // console.log(this.params.size / (2.0 * Math.PI))
        slopeXSpectrum[n][m] = h_k_t.multiply(new Complex(0, kx * slopeScale))
        slopeZSpectrum[n][m] = h_k_t.multiply(new Complex(0, kz * slopeScale))

        /**
         * 水平位移谱（Choppy waves 模型）
         *   d_x(k) = -i * (kx/|k|) * λ * h(k,t)
         *   d_z(k) = -i * (kz/|k|) * λ * h(k,t)
         * λ 是 choppiness 系数，控制水平拉伸程度
         */
        if (k > 0.000001) {
          const kxNorm = kx / k
          const kzNorm = kz / k
          dispXSpectrum[n][m] = h_k_t.multiply(new Complex(0, -kxNorm * this.params.choppiness))
          dispZSpectrum[n][m] = h_k_t.multiply(new Complex(0, -kzNorm * this.params.choppiness))
        } else {
          dispXSpectrum[n][m] = new Complex(0, 0)
          dispZSpectrum[n][m] = new Complex(0, 0)
        }
      }
    }

    // 执行 2D IFFT，从频域转回时域
    const heightSpatial = this.fftProcessor.ifft2DInterface(heightSpectrum)
    // ∂η/∂x = IFFT( i * k_x * h(k, t) ) = Σ ik·h(k,t) · e^(ik_x * x)
    // const slopeXSpatial = this.fftProcessor.ifft2DInterface(slopeXSpectrum)
    // // ∂η/∂z = IFFT( i * k_z * h(k, t) ) = Σ ik·h(k,t) · e^(ik_z * z)
    // const slopeZSpatial = this.fftProcessor.ifft2DInterface(slopeZSpectrum)
    // const dispXSpatial = this.fftProcessor.ifft2DInterface(dispXSpectrum)
    // const dispZSpatial = this.fftProcessor.ifft2DInterface(dispZSpectrum)
    // const { slopeXSpatial, slopeZSpatial, dispXSpatial, dispZSpatial } =
    //   await this.computeInWorkers({
    //     slopeXSpectrum,
    //     slopeZSpectrum,
    //     dispXSpectrum,
    //     dispZSpectrum
    //   })

    // console.log(slopeXSpatial[0][0])

    // Debug Code -- 检查虚部大小
    if (__DEBUG__) {
      let maxImag = 0
      let avgImag = 0
      let realRange = 0
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const imagPart = Math.abs(heightSpatial[i][j].imag)
          const realPart = Math.abs(heightSpatial[i][j].real)

          maxImag = Math.max(maxImag, imagPart)
          avgImag += imagPart
          realRange = Math.max(realRange, realPart)
        }
      }
      avgImag /= N * N

      console.log(`虚部最大值: ${maxImag}, 平均虚部: ${avgImag}, 实部范围: ${realRange}`)
      console.log(`虚部/实部比: ${maxImag / realRange}`)
    }

    // 统一幅值放大倍数
    const amplitude = this.params.amplitude ?? 1

    // 提取实部并存储
    let index = 0
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        // Debug Code -- 检查 heightField[index]、displacementX[index]、displacementZ[index] 是否存在，以及 heightField[index] 中的数据是否被写入了 Displacement Texture
        if (__DEBUG__) {
          const x = (i / N) * this.params.size
          const z = (j / N) * this.params.size
          this.heightField[index] = Math.sin(x * 0.1 + time) * Math.sin(z * 0.1 + time) * 5.0
          this.displacementX[index] = 0
          this.displacementZ[index] = 0
          console.log(this.heightField[index])
          console.log(this.displacementX[index], this.displacementZ[index])
        }

        // this.heightField[index] = heightSpatial[i][j].real * amplitude
        // this.normalX[index] = slopeXSpatial[i][j].real * amplitude
        // this.normalZ[index] = slopeZSpatial[i][j].real * amplitude
        // this.displacementX[index] = dispXSpatial[i][j].real * amplitude
        // this.displacementZ[index] = dispZSpatial[i][j].real * amplitude
        index++
      }
    }
  }

  /**
   * 计算时间 t 的振幅谱 h(k,t)
   * h(k,t) = h₀(k) * e^(i * ω * t) + h₀*^(-k) * e^(-i * ω * t)
   * ω(k) = sqrt(g * |k|)  (深水波色散关系)
   */
  private calculateAmplitudeAtTime(n: number, m: number, k: number, time: number): Complex {
    // 色散关系：深水波
    const omega = Math.sqrt(this.params.gravity * k)

    // 时间演化
    const cos_wt = Math.cos(omega * time)
    const sin_wt = Math.sin(omega * time)

    // h(k,t) = h0(k)*exp(iwt) + h0*(-k)*exp(-iwt)
    const h0 = this.h0[n][m]
    const h0_conj = this.h0Conj[n][m]

    return new Complex(
      h0.real * cos_wt - h0.imag * sin_wt + h0_conj.real * cos_wt + h0_conj.imag * sin_wt,
      h0.real * sin_wt + h0.imag * cos_wt - h0_conj.real * sin_wt + h0_conj.imag * cos_wt
    )
  }

  // Getter方法
  getParams(): OceanParams {
    return this.params
  }
  getHeightField(): Float32Array {
    return this.heightField
  }
  getDisplacementX(): Float32Array {
    return this.displacementX
  }
  getDisplacementZ(): Float32Array {
    return this.displacementZ
  }
  getNormalX(): Float32Array {
    return this.normalX
  }
  getNormalZ(): Float32Array {
    return this.normalZ
  }
  getResolution(): number {
    return this.params.resolution
  }
}
