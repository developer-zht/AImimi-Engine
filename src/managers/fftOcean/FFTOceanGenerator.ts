import { FFTProcessor } from '@/math/FFTProcessor/FFTProcessor'
import { Complex } from '@/math/Complex'
import { PhillipsSpectrum } from '@/managers/fftOcean/spectrums/PhillipsSpectrum'
import { SerializedSpatial } from '@/types/worker'
import {
  deserializeArraysToSpatial,
  serializeSpectrumToArrays
} from '@/managers/fftOcean/utils/spectrumSerializer'
import { JONSWAPSpectrum } from '@/managers/fftOcean/spectrums/JONSWAPSpectrum'
import { CascadeConfig, CascadeLayerParams } from '@/types/fftOcean'

// Debug Package
import * as math from 'mathjs'
import { computeRMS } from '@/utils/calcComplexRMS'
import { verifyParseval } from '@/utils/verifyParseval'
import { CascadeLayerData } from './CascadeLayerData'
import { Spectrum } from './spectrums/Spectrum'

// export class FFTOceanGenerator {
//   private fftProcessor: FFTProcessor
//   private params: OceanParams

//   private phillipsSpectrum: PhillipsSpectrum
//   private jonswapSpectrum: JONSWAPSpectrum

//   // 初始振幅谱
//   private h0: Complex[][]
//   private h0Conj: Complex[][]

//   // 输出数据
//   private heightField: Float32Array // 海面高度 η(x,t)
//   private displacementX: Float32Array // X 方向水平位移
//   private displacementZ: Float32Array // Z 方向水平位移
//   private normalX: Float32Array // 法线的 X 分量 (∂η/∂x)
//   private normalZ: Float32Array // 法线的 Z 分量 (∂η/∂z)

//   // Debug 次数
//   private printCount = 0
//   private printMaxCount = 20

//   private workers: Map<string, Worker> = new Map()
//   private workerPromises: Map<
//     string,
//     { resolve: (complex: Complex[][]) => void; reject: (event: ErrorEvent) => void }
//   > = new Map()

//   constructor(params: OceanParams) {
//     this.fftProcessor = new FFTProcessor()
//     this.params = params

//     this.phillipsSpectrum = new PhillipsSpectrum()
//     this.jonswapSpectrum = new JONSWAPSpectrum()

//     const N = params.resolution
//     this.heightField = new Float32Array(N * N)
//     this.displacementX = new Float32Array(N * N)
//     this.displacementZ = new Float32Array(N * N)
//     this.normalX = new Float32Array(N * N)
//     this.normalZ = new Float32Array(N * N)

//     this.generateInitialSpectrum()

//     // 初始化 woker
//     this.initializeWorkers()
//   }

//   // 创建计算 IFFT 的 worker 的通用方法
//   private createWorker(name: string, scriptPath: string): Worker {
//     const worker = new Worker(new URL(scriptPath, import.meta.url), {
//       type: 'module'
//     })

//     worker.addEventListener('message', (event: MessageEvent<SerializedSpatial>) => {
//       const promise = this.workerPromises.get(name)
//       if (promise) {
//         const { realArray, imagArray, dimension } = event.data
//         const spatial = deserializeArraysToSpatial(realArray, imagArray, dimension)
//         promise.resolve(spatial)
//         this.workerPromises.delete(name)
//       }
//     })

//     worker.addEventListener('error', (event: ErrorEvent) => {
//       const promise = this.workerPromises.get(name)
//       if (promise) {
//         promise.reject(event)
//         this.workerPromises.delete(name)
//       }
//     })

//     return worker
//   }

//   // 创建一组计算 IFFT 的 worker
//   private initializeWorkers() {
//     this.workers.set('slopeX', this.createWorker('slopeX', './workers/CalcSlopeXSpatial.ts'))
//     this.workers.set('slopeZ', this.createWorker('slopeZ', './workers/CalcSlopeZSpatial.ts'))
//     this.workers.set('dispX', this.createWorker('dispX', './workers/CalcDispXSpatial.ts'))
//     this.workers.set('dispZ', this.createWorker('dispZ', './workers/CalcDispZSpatial.ts'))
//   }

//   // 对单个 worker 的计算行为进行封装
//   private computeInWorker(name: string, spectrum: Complex[][]): Promise<Complex[][]> {
//     return new Promise((resolve, reject) => {
//       const worker = this.workers.get(name)

//       if (!worker) {
//         reject(new Error('Worker not initialized'))
//         return
//       }

//       this.workerPromises.set(name, { resolve, reject })

//       // 因为 postMessage 的参数类型有限
//       // 因此将 spectrum: Complex[][] 转换成包含 Float32Array 的对象以便 postMessage 传输
//       const serializedSpectrum = serializeSpectrumToArrays(spectrum)

//       worker.postMessage(serializedSpectrum)
//     })
//   }

//   // 使用 Promise.all 同步处理 IFFT 计算的结果
//   private async computeInWorkers(spectrums: {
//     slopeXSpectrum: Complex[][]
//     slopeZSpectrum: Complex[][]
//     dispXSpectrum: Complex[][]
//     dispZSpectrum: Complex[][]
//   }) {
//     const slopeXSpatialPromise = this.computeInWorker('slopeX', spectrums.slopeXSpectrum)
//     const slopeZSpatialPromise = this.computeInWorker('slopeZ', spectrums.slopeZSpectrum)
//     const dispXSpatialPromise = this.computeInWorker('dispX', spectrums.dispXSpectrum)
//     const dispZSpatialPromise = this.computeInWorker('dispZ', spectrums.dispZSpectrum)

//     try {
//       const results = await Promise.all([
//         slopeXSpatialPromise,
//         slopeZSpatialPromise,
//         dispXSpatialPromise,
//         dispZSpatialPromise
//       ])

//       const spatialData = {
//         slopeXSpatial: results[0],
//         slopeZSpatial: results[1],
//         dispXSpatial: results[2],
//         dispZSpatial: results[3]
//       }

//       return spatialData
//     } catch (error) {
//       console.log(error)
//     }
//   }

//   /**
//    * 将频率索引转换为波数 k
//    * - index < N/2 → 正频率
//    * - index >= N/2 → 负频率
//    * - k = 2π * n / L
//    */
//   private getWaveNumber(index: number, N: number, L: number): number {
//     // index < N/2 为正频率，>= N/2 为负频率
//     const n = index < N / 2 ? index : index - N
//     // if (Math.abs(n) < 0.001) {
//     //   n = 0.001 * Math.sign(n) || 0.001 // 给一个小的非零值
//     // }

//     return (2 * Math.PI * n) / L
//   }

//   /**
//    * 高斯随机数生成器(Box–Muller 变换)
//    */
//   private gaussianRandom(): number {
//     let u1 = 0,
//       u2 = 0
//     while (u1 === 0) u1 = Math.random()
//     while (u2 === 0) u2 = Math.random()
//     return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
//   }

//   /**
//    * 基于 Phillips 波谱 和 FFT 的海面生成器
//    *
//    * 核心物理模型：
//    * 1. 初始振幅谱：
//    *    h0(k) = sqrt(P(k) / 2) * (xi_r + i * xi_i)
//    *    - P(k)：Phillips 波谱值
//    *    - xi_r, xi_i：高斯随机数（均值0，方差1）
//    *
//    * 2. 色散关系（深水波）：
//    *    ω = sqrt(g * |k|)
//    *
//    * 3. 时间演化：
//    *    h(k, t) = h0(k) * exp(i * omega * t) + conj(h0(-k)) * exp(-i * omega * t)
//    *    - 保证结果为实数场（共轭对称性）
//    *
//    * 4. 空间域转换：
//    *    η(x, t) = IFFT2(h(k, t))
//    *
//    * 5. 派生量：
//    *    - 法线（斜率）：slope_x = h(k, t) * (i * kx)
//    *    - 位移（choppy waves）：
//    *      disp_x = h(k, t) * (-i * kx / |k| * choppiness)
//    *
//    * 实现细节
//    * - getWaveNumber：处理 FFT 索引到实际波数的映射
//    * - gaussianRandom：Box-Muller 方法生成高斯分布随机数
//    * - generateInitialSpectrum：构造符合波谱的初始频域波场
//    * - update：每帧计算频域演化 -> IFFT -> 空间域高度 / 位移 / 法线
//    */

//   /**
//    * 生成初始振幅谱 h0(k)
//    * - h0(k) 是初始时刻的复振幅谱，统计特性由 Phillips 波谱 P(k) 给出
//    * - 公式：h0(k) = sqrt(P(k) / 2) * (xi_r + i * xi_i)
//    * - 随机相位来自高斯分布 xi_r, xi_i ~ N(0,1)
//    */
//   private generateInitialSpectrum(): void {
//     const N = this.params.resolution // 海浪分辨率（vertex 的密度）
//     const L = this.params.size // 海浪尺寸
//     const deltaK = (2 * Math.PI) / L // 波数网格间距
//     const h0Magnitudes: number[] = []

//     // Debug Code
//     const kValues: number[] = []
//     let E_freq = 0

//     this.h0 = Array(N)
//       .fill(null)
//       .map(() => Array(N))
//     this.h0Conj = Array(N)
//       .fill(null)
//       .map(() => Array(N))

//     for (let n = 0; n < N; n++) {
//       for (let m = 0; m < N; m++) {
//         // 计算波向量 kx, kz
//         // kx = 2π * n' / L 需要通过判断 n 与 N/2 的大小关系来决定 n' 的取值，因此 n' 可为负
//         const kx = this.getWaveNumber(n, N, L)
//         const kz = this.getWaveNumber(m, N, L)
//         const k = Math.sqrt(kx * kx + kz * kz)

//         // Debug Code
//         if (k > 0.001) {
//           // 排除DC分量
//           kValues.push(k)

//           // 计算h0
//           const h0Mag = this.jonswapSpectrum.calculateH0Magnitude(kx, kz, this.params)
//           h0Magnitudes.push(h0Mag)
//         }

//         // 跳过DC分量
//         if (Math.abs(kx) < 0.001 && Math.abs(kz) < 0.001) {
//           this.h0[n][m] = new Complex(0, 0)
//           continue
//         }

//         // JONSWAP 波谱
//         // const jonswapValue = this.jonswapSpectrum.calculateJ(kx, kz, this.params)
//         const jonswapH0Magnitude = this.jonswapSpectrum.calculateH0Magnitude(kx, kz, this.params)
//         // const jonswapH0Magnitude = this.jonswapSpectrum.calculateH0MagnitudeSimplified(
//         //   kx,
//         //   kz,
//         //   this.params,
//         //   deltaK
//         // )
//         // console.log(jonswapValue)

//         // Phillips 波谱
//         const phillipsValue = Math.max(0.0, this.phillipsSpectrum.calculate(kx, kz, this.params))
//         const phillipsH0Magnitude = this.phillipsSpectrum.calculateH0Magnitude(kx, kz, this.params)
//         // console.log(phillipsValue)

//         // 高斯随机数
//         const xi_r = this.gaussianRandom()
//         const xi_i = this.gaussianRandom()

//         // h0(k) = sqrt(P/2) * (xi_r + i*xi_i)
//         // this.h0[n][m] = new Complex(phillipsH0Magnitude * xi_r, phillipsH0Magnitude * xi_i)

//         this.h0[n][m] = new Complex(jonswapH0Magnitude * xi_r, jonswapH0Magnitude * xi_i)

//         const h = this.h0[n][m]
//         E_freq += h.real * h.real + h.imag * h.imag
//       }
//     }

//     /**
//      * Debug Code
//      * 统计分析
//      * 检查 h0 是否非零
//      */
//     console.log(`h0[${N / 2}][${N / 2}]:`, {
//       real: this.h0[N / 2][N / 2].real.toExponential(),
//       imag: this.h0[N / 2][N / 2].imag
//     })
//     console.log('=== k值统计 ===')
//     console.log('k_min:', Math.min(...kValues))
//     console.log('k_max:', Math.max(...kValues))
//     console.log('k_avg:', kValues.reduce((a, b) => a + b) / kValues.length)

//     console.log('=== h0值统计 ===')
//     console.log('h0_min:', Math.min(...h0Magnitudes))
//     console.log('h0_max:', Math.max(...h0Magnitudes))
//     console.log('h0_avg:', h0Magnitudes.reduce((a, b) => a + b) / h0Magnitudes.length)
//     console.log('非零h0数量:', h0Magnitudes.filter((v) => v > 0.0001).length)

//     // 第二次循环：计算 h0Conj
//     for (let n = 0; n < N; n++) {
//       for (let m = 0; m < N; m++) {
//         // 确保实数输出的共轭对称性 h₀(-k) = h₀*(k)
//         // 特殊处理 DC 分量
//         if (n === 0 && m === 0) {
//           this.h0Conj[n][m] = new Complex(0, 0)
//           continue
//         }
//         const n_conj = n === 0 ? 0 : N - n
//         const m_conj = m === 0 ? 0 : N - m

//         this.h0Conj[n][m] = new Complex(this.h0[n_conj][m_conj].real, -this.h0[n_conj][m_conj].imag)
//       }
//     }
//   }

//   /**
//    * 更新海面状态到时间 t
//    * 核心公式（频域时间演化）：
//    * h(k,t) = h₀(k) * e^(i * ω * t) + h₀*^(-k) * e^(-i * ω * t)
//    * 深水色散关系: ω(k) = sqrt(g * |k|)
//    */
//   async update(time: number): Promise<void> {
//     const N = this.params.resolution
//     const L = this.params.size

//     /**
//      * 初始化频域（k 空间）存储
//      * heightSpectrum    : 高度场频谱 η̂(k, t)
//      * slopeXSpectrum    : x 方向高度梯度频谱（用于法线）
//      * slopeZSpectrum    : z 方向高度梯度频谱
//      * dispXSpectrum     : x 方向水平位移频谱（choppy waves）
//      * dispZSpectrum     : z 方向水平位移频谱
//      */
//     const heightSpectrum: Complex[][] = Array(N)
//       .fill(null)
//       .map(() => Array(N))
//     const slopeXSpectrum: Complex[][] = Array(N)
//       .fill(null)
//       .map(() => Array(N))
//     const slopeZSpectrum: Complex[][] = Array(N)
//       .fill(null)
//       .map(() => Array(N))
//     const dispXSpectrum: Complex[][] = Array(N)
//       .fill(null)
//       .map(() => Array(N))
//     const dispZSpectrum: Complex[][] = Array(N)
//       .fill(null)
//       .map(() => Array(N))

//     for (let n = 0; n < N; n++) {
//       for (let m = 0; m < N; m++) {
//         /**
//          * 频率向量 k = (k_x, k_z)
//          * 公式：
//          *   k_x = 2π (n - N/2) / L
//          *   k_z = 2π (m - N/2) / L
//          * 物理意义：波数（rad/m），控制波长 λ = 2π / |k|
//          */
//         const kx = this.getWaveNumber(n, N, L)
//         const kz = this.getWaveNumber(m, N, L)
//         const k = Math.sqrt(kx * kx + kz * kz)

//         /**
//          * 计算随时间演化的振幅谱 h(k, t)
//          * 公式：
//          *   h(k, t) = h₀(k) * e^(i * ω * t) + h₀*^(-k) * e^(-i * ω * t)
//          * 其中 ω = sqrt(g |k|) （深水波色散关系）
//          */
//         const h_k_t = this.calculateAmplitudeAtTime(n, m, k, time)

//         // 高度谱 η̂(k,t)
//         heightSpectrum[n][m] = h_k_t

//         /**
//          * 梯度谱（不是梯度）：
//          *   i * k_x * h(k, t)
//          *   i * k_z * h(k, t)
//          * 与梯度的关系：
//          *   ∂η/∂x = IFFT( i * k_x * h(k, t) ) = Σ ik·h(k,t) · e^(ik_x * x)
//          *   ∂η/∂z = IFFT( i * k_z * h(k, t) ) = Σ ik·h(k,t) · e^(ik_z * z)
//          * 这里用 (0, k_x) 相当于乘以 i k_x
//          */
//         // const slopeScale = this.params.size / (2.0 * Math.PI)
//         const slopeScale = 1
//         // Debug Code
//         // console.log(this.params.size / (2.0 * Math.PI))
//         slopeXSpectrum[n][m] = h_k_t.multiply(new Complex(0, kx * slopeScale))
//         slopeZSpectrum[n][m] = h_k_t.multiply(new Complex(0, kz * slopeScale))

//         /**
//          * 水平位移谱（Choppy waves 模型）
//          *   d_x(k) = -i * (kx/|k|) * λ * h(k,t)
//          *   d_z(k) = -i * (kz/|k|) * λ * h(k,t)
//          * λ 是 choppiness 系数，控制水平拉伸程度
//          */
//         if (k > 0.000001) {
//           const kxNorm = kx / k
//           const kzNorm = kz / k
//           dispXSpectrum[n][m] = h_k_t.multiply(new Complex(0, -kxNorm * this.params.choppiness))
//           dispZSpectrum[n][m] = h_k_t.multiply(new Complex(0, -kzNorm * this.params.choppiness))
//         } else {
//           dispXSpectrum[n][m] = new Complex(0, 0)
//           dispZSpectrum[n][m] = new Complex(0, 0)
//         }
//       }
//     }

//     if (this.printCount < this.printMaxCount) {
//       // Debug Code
//       // 统计 heightSpectrum
//       let maxMag = 0
//       for (let i = 0; i < N; i++) {
//         for (let j = 0; j < N; j++) {
//           const mag = Math.sqrt(
//             heightSpectrum[i][j].real * heightSpectrum[i][j].real +
//               heightSpectrum[i][j].imag * heightSpectrum[i][j].imag
//           )
//           maxMag = Math.max(maxMag, mag)
//         }
//       }
//       console.log('heightSpectrum 最大幅值:', maxMag.toExponential(2))
//     }

//     // 执行 2D IFFT，从频域转回时域
//     // Debug Code
//     if (__DEBUG__) {
//       const mathFFTHeightSpectrum = heightSpectrum.map((row) =>
//         row.map((c) => math.complex(c.real, c.imag))
//       )
//       const result = math.ifft(mathFFTHeightSpectrum)
//       const heightSpatial: Complex[][] = result.map((row) =>
//         row.map((c) => new Complex(c.re, c.im))
//       )
//       const customFFTheightSpatial1 = this.fftProcessor.ifft2DInterface(heightSpectrum)

//       for (let m = 0; m < 256; m++) {
//         for (let n = 0; n < 256; n++) {
//           console.log(
//             heightSpatial[m][n].real - customFFTheightSpatial1[m][n].real < 1e-10 &&
//               heightSpatial[m][n].imag - customFFTheightSpatial1[m][n].imag < 1e-10
//           )
//         }
//       }
//     }
//     const heightSpatial = this.fftProcessor.ifft2DInterface(heightSpectrum)
//     // ∂η/∂x = IFFT( i * k_x * h(k, t) ) = Σ ik·h(k,t) · e^(ik_x * x)
//     // const slopeXSpatial = this.fftProcessor.ifft2DInterface(slopeXSpectrum)
//     // // ∂η/∂z = IFFT( i * k_z * h(k, t) ) = Σ ik·h(k,t) · e^(ik_z * z)
//     // const slopeZSpatial = this.fftProcessor.ifft2DInterface(slopeZSpectrum)
//     // const dispXSpatial = this.fftProcessor.ifft2DInterface(dispXSpectrum)
//     // const dispZSpatial = this.fftProcessor.ifft2DInterface(dispZSpectrum)
//     const { slopeXSpatial, slopeZSpatial, dispXSpatial, dispZSpatial } =
//       await this.computeInWorkers({
//         slopeXSpectrum,
//         slopeZSpectrum,
//         dispXSpectrum,
//         dispZSpectrum
//       })

//     if (this.printCount < this.printMaxCount) {
//       // Debug Code
//       // 立即检查
//       console.log('heightSpatial[0][0]:', {
//         real: heightSpatial[0][0].real.toExponential(),
//         imag: heightSpatial[0][0].imag
//       })
//       let maxSpatial = 0
//       for (let i = 0; i < N; i++) {
//         for (let j = 0; j < N; j++) {
//           maxSpatial = Math.max(
//             maxSpatial,
//             Math.sqrt(heightSpatial[i][j].real ** 2 + heightSpatial[i][j].imag ** 2)
//           )
//         }
//       }
//       console.log('heightSpatial 最大幅值:', maxSpatial.toExponential(2))
//       // console.log('ratio =', maxMag / maxSpatial)
//       console.log('RMS Ratio =', computeRMS(heightSpectrum) / computeRMS(heightSpatial))
//       console.log('Verify Parseval ', verifyParseval(heightSpatial, heightSpectrum))
//     }

//     // Debug Code -- 检查虚部大小
//     if (__DEBUG__) {
//       let maxImag = 0
//       let avgImag = 0
//       let realRange = 0
//       for (let i = 0; i < N; i++) {
//         for (let j = 0; j < N; j++) {
//           const imagPart = Math.abs(heightSpatial[i][j].imag)
//           const realPart = Math.abs(heightSpatial[i][j].real)

//           maxImag = Math.max(maxImag, imagPart)
//           avgImag += imagPart
//           realRange = Math.max(realRange, realPart)
//         }
//       }
//       avgImag /= N * N

//       console.log(`虚部最大值: ${maxImag}, 平均虚部: ${avgImag}, 实部范围: ${realRange}`)
//       console.log(`虚部/实部比: ${maxImag / realRange}`)
//     }

//     // 统一幅值放大倍数
//     const amplitude = this.params.amplitude ?? 1

//     // 提取实部并存储
//     let index = 0
//     for (let i = 0; i < N; i++) {
//       for (let j = 0; j < N; j++) {
//         // Debug Code -- 检查 heightField[index]、displacementX[index]、displacementZ[index] 是否存在，以及 heightField[index] 中的数据是否被写入了 Displacement Texture
//         if (__DEBUG__) {
//           const x = (i / N) * this.params.size
//           const z = (j / N) * this.params.size
//           this.heightField[index] = Math.sin(x * 0.1 + time) * Math.sin(z * 0.1 + time) * 5.0
//           this.displacementX[index] = 0
//           this.displacementZ[index] = 0
//           console.log(this.heightField[index])
//           console.log(this.displacementX[index], this.displacementZ[index])
//         }

//         this.heightField[index] = heightSpatial[i][j].real * amplitude
//         this.normalX[index] = slopeXSpatial[i][j].real * amplitude
//         this.normalZ[index] = slopeZSpatial[i][j].real * amplitude
//         this.displacementX[index] = dispXSpatial[i][j].real * amplitude
//         this.displacementZ[index] = dispZSpatial[i][j].real * amplitude
//         index++
//       }
//     }

//     if (this.printCount < this.printMaxCount) {
//       // Debug Code
//       // ===== 添加波高统计 =====
//       const heights = Array.from(this.heightField)
//       const minHeight = Math.min(...heights)
//       const maxHeight = Math.max(...heights)

//       // 计算 RMS（均方根）
//       // const sumSquares = heights.reduce((sum, h) => sum + h * h, 0)
//       // const rms = Math.sqrt(sumSquares / heights.length)

//       // 有效波高 Hs = 4 * RMS
//       // const Hs = 4 * rms

//       console.log('=== 波高统计 (时刻 t=' + time.toFixed(2) + 's) ===')
//       console.log('最小波高:', minHeight, 'm')
//       console.log('最大波高:', maxHeight, 'm')
//       // console.log('RMS 波高:', rms, 'm')
//       // console.log('有效波高 Hs:', Hs, 'm')
//       console.log('波高范围:', maxHeight - minHeight, 'm')

//       this.printCount++
//     }
//   }

//   /**
//    * 计算时间 t 的振幅谱 h(k,t)
//    * h(k,t) = h₀(k) * e^(i * ω * t) + h₀*^(-k) * e^(-i * ω * t)
//    * ω(k) = sqrt(g * |k|)  (深水波色散关系)
//    */
//   private calculateAmplitudeAtTime(n: number, m: number, k: number, time: number): Complex {
//     // 色散关系：深水波
//     const omega = Math.sqrt(this.params.gravity * k)

//     // 时间演化
//     const cos_wt = Math.cos(omega * time)
//     const sin_wt = Math.sin(omega * time)

//     // h(k,t) = h0(k)*exp(iwt) + h0*(-k)*exp(-iwt)
//     const h0 = this.h0[n][m]
//     const h0_conj = this.h0Conj[n][m]

//     return new Complex(
//       h0.real * cos_wt - h0.imag * sin_wt + h0_conj.real * cos_wt + h0_conj.imag * sin_wt,
//       h0.real * sin_wt + h0.imag * cos_wt - h0_conj.real * sin_wt + h0_conj.imag * cos_wt
//     )
//   }

//   // Getter方法
//   getParams(): OceanParams {
//     return this.params
//   }
//   getHeightField(): Float32Array {
//     return this.heightField
//   }
//   getDisplacementX(): Float32Array {
//     return this.displacementX
//   }
//   getDisplacementZ(): Float32Array {
//     return this.displacementZ
//   }
//   getNormalX(): Float32Array {
//     return this.normalX
//   }
//   getNormalZ(): Float32Array {
//     return this.normalZ
//   }
//   getResolution(): number {
//     return this.params.resolution
//   }

//   // ---------- Test Part ----------
//   // test interface
//   getTestHeightData(time: number): { heightSpectrum: Complex[][]; heightSpatial: Complex[][] } {
//     const N = this.params.resolution
//     const L = this.params.size

//     /**
//      * 初始化频域（k 空间）存储
//      * heightSpectrum    : 高度场频谱 η̂(k, t)
//      */
//     const heightSpectrum: Complex[][] = Array(N)
//       .fill(null)
//       .map(() => Array(N))

//     for (let n = 0; n < N; n++) {
//       for (let m = 0; m < N; m++) {
//         /**
//          * 频率向量 k = (k_x, k_z)
//          * 公式：
//          *   k_x = 2π (n - N/2) / L
//          *   k_z = 2π (m - N/2) / L
//          * 物理意义：波数（rad/m），控制波长 λ = 2π / |k|
//          */
//         const kx = this.getWaveNumber(n, N, L)
//         const kz = this.getWaveNumber(m, N, L)
//         const k = Math.sqrt(kx * kx + kz * kz)

//         /**
//          * 计算随时间演化的振幅谱 h(k, t)
//          * 公式：
//          *   h(k, t) = h₀(k) * e^(i * ω * t) + h₀*^(-k) * e^(-i * ω * t)
//          * 其中 ω = sqrt(g |k|) （深水波色散关系）
//          */
//         const h_k_t = this.calculateAmplitudeAtTime(n, m, k, time)

//         // 高度谱 η̂(k,t)
//         heightSpectrum[n][m] = h_k_t
//       }
//     }

//     const heightSpatial = this.fftProcessor.ifft2DInterface(heightSpectrum)

//     return { heightSpectrum, heightSpatial }
//   }
// }

interface SpectrumData {
  heightSpectrum: Complex[][]
  slopeXSpectrum: Complex[][]
  slopeZSpectrum: Complex[][]
  dispXSpectrum: Complex[][]
  dispZSpectrum: Complex[][]
  dDx_dxSpectrum: Complex[][]
  dDz_dzSpectrum: Complex[][]
  dDx_dzSpectrum: Complex[][]
  dDz_dxSpectrum: Complex[][]
}

interface SingleLayerSpectrumData extends SpectrumData {
  resolution: number
  amplitude: number
}

interface SpatialData {
  heightSpatial: Complex[][]
  slopeXSpatial: Complex[][]
  slopeZSpatial: Complex[][]
  dispXSpatial: Complex[][]
  dispZSpatial: Complex[][]
  dDx_dxSpatial: Complex[][]
  dDz_dzSpatial: Complex[][]
  dDx_dzSpatial: Complex[][]
  dDz_dxSpatial: Complex[][]
}

export class FFTOceanGenerator {
  private fftProcessor: FFTProcessor
  private cascadeConfig: CascadeConfig

  private spectrum: Spectrum
  private phillipsSpectrum: PhillipsSpectrum
  private jonswapSpectrum: JONSWAPSpectrum

  /**
   * cascade 属性
   */
  private cascadeEnabled: boolean
  private targetResolution: number
  private cascadeLayers: CascadeLayerData[] = []

  // 初始振幅谱
  // private h0: Complex[][]
  // private h0Conj: Complex[][]

  // 输出数据
  private heightField: Float32Array // 海面高度 η(x,t)
  private gradX: Float32Array // 梯度的 X 分量 (∂η/∂x)
  private gradZ: Float32Array // 梯度的 Z 分量 (∂η/∂z)
  private displacementX: Float32Array // X 方向水平位移
  private displacementZ: Float32Array // Z 方向水平位移
  private dDx_dx: Float32Array // dDisplacementX / dx
  private dDz_dz: Float32Array // dDisplacementZ / dz
  private dDx_dz: Float32Array // dDisplacementX / dz
  private dDz_dx: Float32Array // dDisplacementZ / dx

  // Debug 次数
  private printCount = 0
  private printMaxCount = 5

  private workers: Map<string, Worker> = new Map()
  private workerPromises: Map<
    string,
    { resolve: (complex: Complex[][]) => void; reject: (event: ErrorEvent) => void }
  > = new Map()

  constructor(gl: WebGLRenderingContext, cascadeConfig: CascadeConfig) {
    this.fftProcessor = new FFTProcessor(gl)
    this.cascadeConfig = cascadeConfig

    // this.phillipsSpectrum = new PhillipsSpectrum()
    this.jonswapSpectrum = new JONSWAPSpectrum()
    this.spectrum = this.jonswapSpectrum

    /**
     * cascade 参数配置
     */
    // true 为 cascade，false 为 single
    this.cascadeEnabled = cascadeConfig.enabled
    // 确定目标分辨率
    this.targetResolution = Math.max(
      ...cascadeConfig.layerParamsSet.map((layer) => layer.resolution)
    )

    this.initializeOutputArrays()

    this.initializeCascadeLayers(this.cascadeConfig, this.spectrum)

    // 初始化 woker
    this.initializeWorkers()
  }

  // 初始化输出数据
  private initializeOutputArrays(): void {
    const N = this.targetResolution

    this.heightField = new Float32Array(N * N)
    this.gradZ = new Float32Array(N * N)
    this.gradX = new Float32Array(N * N)
    this.displacementX = new Float32Array(N * N)
    this.displacementZ = new Float32Array(N * N)
    this.dDx_dx = new Float32Array(N * N)
    this.dDz_dz = new Float32Array(N * N)
    this.dDx_dz = new Float32Array(N * N)
    this.dDz_dx = new Float32Array(N * N)
  }

  // 初始化单个 Cascade Layer
  private initializeSingleLayer(cascadeLayerParams: CascadeLayerParams, spectrum: Spectrum) {
    const layerData = new CascadeLayerData(cascadeLayerParams, spectrum)
    return layerData
  }
  // 初始化多个 Cascade Layer
  private initializeCascadeLayers(cascadeConfig: CascadeConfig, spectrum: Spectrum): void {
    // Cascade Layers
    if (cascadeConfig.enabled && cascadeConfig.layerParamsSet.length > 1) {
      this.cascadeLayers = cascadeConfig.layerParamsSet.map((param) => {
        const layerData = new CascadeLayerData(param, spectrum)
        return layerData
      })
      return
    } else if (!cascadeConfig.enabled && cascadeConfig.layerParamsSet.length > 0) {
      console.log('cascadeConfig.layerParamsSet[0]', cascadeConfig.layerParamsSet[0])
      // 单层 Layer
      this.cascadeLayers[0] = this.initializeSingleLayer(
        cascadeConfig.layerParamsSet[0],
        this.spectrum
      )
      return
    } else {
      // 既不是 Cascade Layers 也不是 Single Layer，就抛出错误
      console.log('❌ 创建 CascadeLayerData 失败')
      throw new Error('❌ 创建 CascadeLayerData 失败')
    }
  }

  // 创建一组计算 IFFT 的 worker
  private initializeWorkers() {
    this.workers.set('slopeX', this.createWorker('slopeX', './workers/CalcSlopeXSpatial.ts'))
    this.workers.set('slopeZ', this.createWorker('slopeZ', './workers/CalcSlopeZSpatial.ts'))
    this.workers.set('dispX', this.createWorker('dispX', './workers/CalcDispXSpatial.ts'))
    this.workers.set('dispZ', this.createWorker('dispZ', './workers/CalcDispZSpatial.ts'))
    this.workers.set('dDx_dx', this.createWorker('dDx_dx', './workers/CalcDxdxSpatial.ts'))
    this.workers.set('dDz_dz', this.createWorker('dDz_dz', './workers/CalcDzdzSpatial.ts'))
    this.workers.set('dDx_dz', this.createWorker('dDx_dz', './workers/CalcDxdzSpatial.ts'))
    this.workers.set('dDz_dx', this.createWorker('dDz_dx', './workers/CalcDzdxSpatial.ts'))
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
    dDx_dxSpectrum: Complex[][]
    dDz_dzSpectrum: Complex[][]
    dDx_dzSpectrum: Complex[][]
    dDz_dxSpectrum: Complex[][]
  }): Promise<Omit<SpatialData, 'heightSpatial'>> {
    const slopeXSpatialPromise = this.computeInWorker('slopeX', spectrums.slopeXSpectrum)
    const slopeZSpatialPromise = this.computeInWorker('slopeZ', spectrums.slopeZSpectrum)
    const dispXSpatialPromise = this.computeInWorker('dispX', spectrums.dispXSpectrum)
    const dispZSpatialPromise = this.computeInWorker('dispZ', spectrums.dispZSpectrum)
    const dDx_dxSpatialPromise = this.computeInWorker('dDx_dx', spectrums.dDx_dxSpectrum)
    const dDz_dzSpatialPromise = this.computeInWorker('dDz_dz', spectrums.dDz_dzSpectrum)
    const dDx_dzSpatialPromise = this.computeInWorker('dDx_dz', spectrums.dDx_dzSpectrum)
    const dDz_dxSpatialPromise = this.computeInWorker('dDz_dx', spectrums.dDz_dxSpectrum)

    try {
      const results = await Promise.all([
        slopeXSpatialPromise,
        slopeZSpatialPromise,
        dispXSpatialPromise,
        dispZSpatialPromise,
        dDx_dxSpatialPromise,
        dDz_dzSpatialPromise,
        dDx_dzSpatialPromise,
        dDz_dxSpatialPromise
      ])

      const spatialData = {
        slopeXSpatial: results[0],
        slopeZSpatial: results[1],
        dispXSpatial: results[2],
        dispZSpatial: results[3],
        dDx_dxSpatial: results[4],
        dDz_dzSpatial: results[5],
        dDx_dzSpatial: results[6],
        dDz_dxSpatial: results[7]
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
   * 主要的海洋更新方法 - 现在支持 cascade
   */
  async generateOcean(time: number): Promise<void> {
    if (!this.cascadeEnabled) {
      const cascadeLayerData = this.cascadeLayers[0]
      // 原始单层处理
      await this.updateSingleLayer(cascadeLayerData, time)
    } else {
      // Cascade 处理
      await this.updateCascadeLayers(time)
    }
  }

  private async spectrumToSpatial(spectrums: SpectrumData): Promise<SpatialData> {
    const {
      heightSpectrum,
      slopeXSpectrum,
      slopeZSpectrum,
      dispXSpectrum,
      dispZSpectrum,
      dDx_dxSpectrum,
      dDz_dzSpectrum,
      dDx_dzSpectrum,
      dDz_dxSpectrum
    } = spectrums

    const controlSign = true
    if (controlSign) {
      this.fftProcessor.enableGPU(true)
      const heightSpatial = this.fftProcessor.ifft2DInterface(heightSpectrum)
      const slopeXSpatial = this.fftProcessor.ifft2DInterface(slopeXSpectrum)
      const slopeZSpatial = this.fftProcessor.ifft2DInterface(slopeZSpectrum)
      const dispXSpatial = this.fftProcessor.ifft2DInterface(dispXSpectrum)
      const dispZSpatial = this.fftProcessor.ifft2DInterface(dispZSpectrum)
      const dDx_dxSpatial = this.fftProcessor.ifft2DInterface(dDx_dxSpectrum)
      const dDz_dzSpatial = this.fftProcessor.ifft2DInterface(dDz_dzSpectrum)
      const dDx_dzSpatial = this.fftProcessor.ifft2DInterface(dDx_dzSpectrum)
      const dDz_dxSpatial = this.fftProcessor.ifft2DInterface(dDz_dxSpectrum)

      return {
        heightSpatial,
        slopeXSpatial,
        slopeZSpatial,
        dispXSpatial,
        dispZSpatial,
        dDx_dxSpatial,
        dDz_dzSpatial,
        dDx_dzSpatial,
        dDz_dxSpatial
      }
    } else {
      const heightSpatial = this.fftProcessor.ifft2DInterface(heightSpectrum)
      // ∂η/∂x = IFFT( i * k_x * h(k, t) ) = Σ ik·h(k,t) · e^(ik_x * x)
      // ∂η/∂z = IFFT( i * k_z * h(k, t) ) = Σ ik·h(k,t) · e^(ik_z * z)
      const {
        slopeXSpatial,
        slopeZSpatial,
        dispXSpatial,
        dispZSpatial,
        dDx_dxSpatial,
        dDz_dzSpatial,
        dDx_dzSpatial,
        dDz_dxSpatial
      } = await this.computeInWorkers({
        slopeXSpectrum,
        slopeZSpectrum,
        dispXSpectrum,
        dispZSpectrum,
        dDx_dxSpectrum,
        dDz_dzSpectrum,
        dDx_dzSpectrum,
        dDz_dxSpectrum
      })

      return {
        heightSpatial,
        slopeXSpatial,
        slopeZSpatial,
        dispXSpatial,
        dispZSpatial,
        dDx_dxSpatial,
        dDz_dzSpatial,
        dDx_dzSpatial,
        dDz_dxSpatial
      }
    }
  }

  // =============== Single Layer Calculation ===============
  private async updateSingleLayer(cascadeLayerData: CascadeLayerData, time: number): Promise<void> {
    this.updateSingleLayerSpectrum(cascadeLayerData, time)
  }

  /**
   * 更新单层海面状态到时间 t
   * 核心公式（频域时间演化）：
   * h(k,t) = h₀(k) * e^(i * ω * t) + h₀*^(-k) * e^(-i * ω * t)
   * 深水色散关系: ω(k) = sqrt(g * |k|)
   */
  private async updateSingleLayerSpectrum(
    cascadeLayerData: CascadeLayerData,
    time: number
  ): Promise<void> {
    const cascadeParams = cascadeLayerData.getCascadeLayerParams()
    const N = cascadeParams.resolution
    // const L = cascadeParams.size

    // const { heightSpectrum, slopeXSpectrum, slopeZSpectrum, dispXSpectrum, dispZSpectrum } =
    //   this.generateSingleLayerSpectrumAtTime(cascadeLayerData, time)
    const {
      heightSpectrum,
      slopeXSpectrum,
      slopeZSpectrum,
      dispXSpectrum,
      dispZSpectrum,
      dDx_dxSpectrum,
      dDz_dzSpectrum,
      dDx_dzSpectrum,
      dDz_dxSpectrum
    } = this.generateSingleLayerSpectrumAtTime(cascadeLayerData, time)

    // 执行 2D IFFT，从频域转回时域
    // Debug Code
    if (__DEBUG__) {
      const mathFFTHeightSpectrum = heightSpectrum.map((row) =>
        row.map((c) => math.complex(c.real, c.imag))
      )
      const result = math.ifft(mathFFTHeightSpectrum)
      const heightSpatial: Complex[][] = result.map((row) =>
        row.map((c) => new Complex(c.re, c.im))
      )
      const customFFTheightSpatial1 = this.fftProcessor.ifft2DInterface(heightSpectrum)

      for (let m = 0; m < 256; m++) {
        for (let n = 0; n < 256; n++) {
          console.log(
            heightSpatial[m][n].real - customFFTheightSpatial1[m][n].real < 1e-10 &&
              heightSpatial[m][n].imag - customFFTheightSpatial1[m][n].imag < 1e-10
          )
        }
      }
    }

    const {
      heightSpatial,
      slopeXSpatial,
      slopeZSpatial,
      dispXSpatial,
      dispZSpatial,
      dDx_dxSpatial,
      dDz_dzSpatial,
      dDx_dzSpatial,
      dDz_dxSpatial
    } = await this.spectrumToSpatial({
      heightSpectrum,
      slopeXSpectrum,
      slopeZSpectrum,
      dispXSpectrum,
      dispZSpectrum,
      dDx_dxSpectrum,
      dDz_dzSpectrum,
      dDx_dzSpectrum,
      dDz_dxSpectrum
    })

    if (this.printCount < this.printMaxCount) {
      // Debug Code
      // 立即检查
      console.log('heightSpatial[0][0]:', {
        real: heightSpatial[0][0].real.toExponential(),
        imag: heightSpatial[0][0].imag
      })
      let maxSpatial = 0
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          maxSpatial = Math.max(
            maxSpatial,
            Math.sqrt(heightSpatial[i][j].real ** 2 + heightSpatial[i][j].imag ** 2)
          )
        }
      }
      console.log('heightSpatial 最大幅值:', maxSpatial.toExponential(2))
      // console.log('ratio =', maxMag / maxSpatial)
      console.log('RMS Ratio =', computeRMS(heightSpectrum) / computeRMS(heightSpatial))
      console.log('Verify Parseval ', verifyParseval(heightSpatial, heightSpectrum))
    }

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

    this.fillOutSingleLayerputArrays(
      cascadeLayerData,
      {
        heightSpatial,
        slopeXSpatial,
        slopeZSpatial,
        dispXSpatial,
        dispZSpatial,
        dDx_dxSpatial,
        dDz_dzSpatial,
        dDx_dzSpatial,
        dDz_dxSpatial
      },
      time
    )
  }

  // 实时生成单层的 Spectrum
  private generateSingleLayerSpectrumAtTime(
    cascadeLayerData: CascadeLayerData,
    time: number
  ): SpectrumData {
    const cascadeParams = cascadeLayerData.getCascadeLayerParams()
    const N = cascadeParams.resolution
    const L = cascadeParams.size
    const amplitude = cascadeParams.amplitude ?? 1.0

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

    const dDx_dxSpectrum: Complex[][] = Array(N)
      .fill(null)
      .map(() => Array(N))
    const dDx_dzSpectrum: Complex[][] = Array(N)
      .fill(null)
      .map(() => Array(N))
    const dDz_dxSpectrum: Complex[][] = Array(N)
      .fill(null)
      .map(() => Array(N))
    const dDz_dzSpectrum: Complex[][] = Array(N)
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
        const kxNorm = kx / k
        const kzNorm = kz / k

        /**
         * 计算随时间演化的振幅谱 h(k, t)
         * 公式：
         *   h(k, t) = h₀(k) * e^(i * ω * t) + h₀*^(-k) * e^(-i * ω * t)
         * 其中 ω = sqrt(g |k|) （深水波色散关系）
         */
        const h_k_t = this.calculateSingleLayerAmplitudeAtTime(cascadeLayerData, n, m, k, time)

        // 高度谱 η̂(k,t)
        heightSpectrum[n][m] = h_k_t

        /**
         * 梯度谱（不是梯度）：
         *   i * k_x * h(k, t)
         *   i * k_z * h(k, t)
         * 与梯度的关系：
         *   ∂η/∂x = Σ ik·h(k,t) · e^(ik_x * x) = IFFT( i * k_x * h(k, t) )
         *   ∂η/∂z = Σ ik·h(k,t) · e^(ik_z * z) = IFFT( i * k_z * h(k, t) )
         * η 是波高，所有的 η 组成了一个波面
         * 这里用 (0, k_x) 相当于乘以 i k_x
         */
        const slopeScale = 1
        // const slopeScale = this.cascadeConfig.targetSize / (2.0 * Math.PI)
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
          dispXSpectrum[n][m] = h_k_t.multiply(new Complex(0, -kxNorm * cascadeParams.choppiness))
          dispZSpectrum[n][m] = h_k_t.multiply(new Complex(0, -kzNorm * cascadeParams.choppiness))
        } else {
          dispXSpectrum[n][m] = new Complex(0, 0)
          dispZSpectrum[n][m] = new Complex(0, 0)
        }

        /**
         * 位移导数谱（不是导数本身）：
         *   ∂D_x/∂x = IFFT( i * k_x * d_x(k) )
         *   ∂D_x/∂z = IFFT( i * k_z * d_x(k) )
         *   ∂D_z/∂x = IFFT( i * k_x * d_z(k) )
         *   ∂D_z/∂z = IFFT( i * k_z * d_z(k) )
         *
         * 这里用 (0, k_x) 相当于乘以 i k_x，
         * 用 (0, k_z) 相当于乘以 i k_z。
         * 注意：d_x(k)、d_z(k) 已经在上一步定义为
         *   d_x(k) = -i * (kx/|k|) * λ * h(k,t)
         *   d_z(k) = -i * (kz/|k|) * λ * h(k,t)
         */
        dDx_dxSpectrum[n][m] = dispXSpectrum[n][m].multiply(new Complex(0, kx))
        dDx_dzSpectrum[n][m] = dispXSpectrum[n][m].multiply(new Complex(0, kz))
        dDz_dxSpectrum[n][m] = dispZSpectrum[n][m].multiply(new Complex(0, kx))
        dDz_dzSpectrum[n][m] = dispZSpectrum[n][m].multiply(new Complex(0, kz))

        dispXSpectrum[n][m].multiplyByScalar(amplitude)
        heightSpectrum[n][m].multiplyByScalar(amplitude)
        dispZSpectrum[n][m].multiplyByScalar(amplitude)
        slopeXSpectrum[n][m].multiplyByScalar(amplitude)
        slopeZSpectrum[n][m].multiplyByScalar(amplitude)
        dDx_dxSpectrum[n][m].multiplyByScalar(amplitude)
        dDz_dzSpectrum[n][m].multiplyByScalar(amplitude)
        dDx_dzSpectrum[n][m].multiplyByScalar(amplitude)
        dDz_dxSpectrum[n][m].multiplyByScalar(amplitude)
      }
    }

    // Debug Code
    if (this.printCount < this.printMaxCount) {
      // Debug Code
      // 统计 heightSpectrum
      let maxMag = 0
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const mag = Math.sqrt(
            heightSpectrum[i][j].real * heightSpectrum[i][j].real +
              heightSpectrum[i][j].imag * heightSpectrum[i][j].imag
          )
          maxMag = Math.max(maxMag, mag)
        }
      }
      console.log('heightSpectrum 最大幅值:', maxMag.toExponential(2))
    }

    return {
      heightSpectrum,
      slopeXSpectrum,
      slopeZSpectrum,
      dispXSpectrum,
      dispZSpectrum,
      dDx_dxSpectrum,
      dDz_dzSpectrum,
      dDx_dzSpectrum,
      dDz_dxSpectrum
    }
  }

  /**
   * 计算时间 t 的振幅谱 h(k,t)
   * h(k,t) = h₀(k) * e^(i * ω * t) + h₀*^(-k) * e^(-i * ω * t)
   * ω(k) = sqrt(g * |k|)  (深水波色散关系)
   */
  private calculateSingleLayerAmplitudeAtTime(
    cascadeLayerData: CascadeLayerData,
    n: number,
    m: number,
    k: number,
    time: number
  ): Complex {
    const cascadeLayerParams = cascadeLayerData.getCascadeLayerParams()
    const { h0, h0Conj } = cascadeLayerData.getH0AndH0Conj()
    // 色散关系：深水波
    const omega = Math.sqrt(cascadeLayerParams.gravity * k)

    // 时间演化
    // const cos_wt = Math.cos(omega * time)
    // const sin_wt = Math.sin(omega * time)

    // h(k,t) = h0(k)*exp(iwt) + h0*(-k)*exp(-iwt)
    const exp_iwt = Complex.expi(omega * time)
    const exp_neg_iwt = Complex.expNegI(omega * time)

    const h0_exp = h0[n][m].multiply(exp_iwt)
    const h0Conj_exp_neg = h0Conj[n][m].multiply(exp_neg_iwt)

    // Debug Code
    // 验证原来的算法和 h0_exp.add(h0Conj_exp_neg) 的差别有多大
    // console.log(
    //   new Complex(
    //     h0[n][m].real * cos_wt -
    //       h0[n][m].imag * sin_wt +
    //       h0Conj[n][m].real * cos_wt +
    //       h0Conj[n][m].imag * sin_wt,
    //     h0[n][m].real * sin_wt +
    //       h0[n][m].imag * cos_wt -
    //       h0Conj[n][m].real * sin_wt +
    //       h0Conj[n][m].imag * cos_wt
    //   )
    //     .subtract(h0_exp.add(h0Conj_exp_neg))
    //     .magnitude() < 1e-10
    // )

    return h0_exp.add(h0Conj_exp_neg)

    // return new Complex(
    //   h0[n][m].real * cos_wt -
    //     h0[n][m].imag * sin_wt +
    //     h0Conj[n][m].real * cos_wt +
    //     h0Conj[n][m].imag * sin_wt,
    //   h0[n][m].real * sin_wt +
    //     h0[n][m].imag * cos_wt -
    //     h0Conj[n][m].real * sin_wt +
    //     h0Conj[n][m].imag * cos_wt
    // )
  }

  // 对输出数据进行填充
  private fillOutSingleLayerputArrays(
    cascadeLayerData: CascadeLayerData,
    spatialData: SpatialData,
    time: number
  ) {
    const cascadeParams = cascadeLayerData.getCascadeLayerParams()
    const {
      heightSpatial,
      slopeXSpatial,
      slopeZSpatial,
      dispXSpatial,
      dispZSpatial,
      dDx_dxSpatial,
      dDz_dzSpatial,
      dDx_dzSpatial,
      dDz_dxSpatial
    } = spatialData
    const N = cascadeParams.resolution

    // 提取实部并存储
    let index = 0
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        // Debug Code -- 检查 heightField[index]、displacementX[index]、displacementZ[index] 是否存在，以及 heightField[index] 中的数据是否被写入了 Displacement Texture
        if (__DEBUG__) {
          const x = (i / N) * cascadeParams.size
          const z = (j / N) * cascadeParams.size
          this.heightField[index] = Math.sin(x * 0.1 + time) * Math.sin(z * 0.1 + time) * 5.0
          this.displacementX[index] = 0
          this.displacementZ[index] = 0
          console.log(this.heightField[index])
          console.log(this.displacementX[index], this.displacementZ[index])
        }

        this.displacementX[index] = dispXSpatial[i][j].real
        this.heightField[index] = heightSpatial[i][j].real
        this.displacementZ[index] = dispZSpatial[i][j].real
        this.gradX[index] = slopeXSpatial[i][j].real
        this.gradZ[index] = slopeZSpatial[i][j].real
        this.dDx_dx[index] = dDx_dxSpatial[i][j].real
        this.dDz_dz[index] = dDz_dzSpatial[i][j].real
        this.dDx_dz[index] = dDx_dzSpatial[i][j].real
        this.dDz_dx[index] = dDz_dxSpatial[i][j].real
        index++
      }
    }

    if (this.printCount < this.printMaxCount) {
      // Debug Code
      // ===== 添加波高统计 =====
      const heights = Array.from(this.heightField)
      const minHeight = Math.min(...heights)
      const maxHeight = Math.max(...heights)

      // 计算 RMS（均方根）
      // const sumSquares = heights.reduce((sum, h) => sum + h * h, 0)
      // const rms = Math.sqrt(sumSquares / heights.length)

      // 有效波高 Hs = 4 * RMS
      // const Hs = 4 * rms

      console.log('=== 波高统计 (时刻 t=' + time.toFixed(2) + 's) ===')
      console.log('最小波高:', minHeight, 'm')
      console.log('最大波高:', maxHeight, 'm')
      // console.log('RMS 波高:', rms, 'm')
      // console.log('有效波高 Hs:', Hs, 'm')
      console.log('波高范围:', maxHeight - minHeight, 'm')

      this.printCount++
      console.log(this.printCount, this.printMaxCount)

      // 统计梯度范围
      let minGradX = Infinity,
        maxGradX = -Infinity
      let minGradZ = Infinity,
        maxGradZ = -Infinity

      for (let i = 0; i < N * N; i++) {
        minGradX = Math.min(minGradX, this.gradX[i])
        maxGradX = Math.max(maxGradX, this.gradX[i])
        minGradZ = Math.min(minGradZ, this.gradZ[i])
        maxGradZ = Math.max(maxGradZ, this.gradZ[i])
      }

      console.log('梯度 X 范围:', [minGradX, maxGradX])
      console.log('梯度 Z 范围:', [minGradZ, maxGradZ])
    }
  }

  // =============== Cascade Layers Calculation ===============
  private async updateCascadeLayers(time: number): Promise<void> {
    const cascadeConfig = this.cascadeConfig
    const layerSpectrumArray = this.generateAllCascadeLayersData(time)

    // 合并所有层
    const mergedSpectrum = this.mergeLayersSpectrum(layerSpectrumArray, cascadeConfig)
    const mergedSpatial = await this.spectrumToSpatial(mergedSpectrum)

    // 填充输出数组
    this.fillOutCascadeLayerputArrays(mergedSpatial, time)
  }

  private generateAllCascadeLayersData(time: number): SingleLayerSpectrumData[] {
    const layerSpectrumArray = this.cascadeLayers.map((cascadeLayerData) => {
      const cascadeParams = cascadeLayerData.getCascadeLayerParams()
      const {
        heightSpectrum,
        slopeXSpectrum,
        slopeZSpectrum,
        dispXSpectrum,
        dispZSpectrum,
        dDx_dxSpectrum,
        dDz_dzSpectrum,
        dDx_dzSpectrum,
        dDz_dxSpectrum
      } = this.generateSingleLayerSpectrumAtTime(cascadeLayerData, time)

      return {
        resolution: cascadeParams.resolution,
        amplitude: cascadeParams.amplitude,
        heightSpectrum,
        slopeXSpectrum,
        slopeZSpectrum,
        dispXSpectrum,
        dispZSpectrum,
        dDx_dxSpectrum,
        dDz_dzSpectrum,
        dDx_dzSpectrum,
        dDz_dxSpectrum
      }
    })

    return layerSpectrumArray
  }

  /**
   * 关键方法：合并所有cascade层
   */
  private mergeLayersSpectrum(
    cascadeLayersSpectrumData: SingleLayerSpectrumData[],
    cascadeConfig: CascadeConfig
  ): SpectrumData {
    const allLayersSpectrumData: SingleLayerSpectrumData[] = [...cascadeLayersSpectrumData]

    // 初始化目标分辨率的空谱
    const mergedHeightSpectrum = this.createEmptySpectrum(this.targetResolution)
    const mergedSlopeXSpectrum = this.createEmptySpectrum(this.targetResolution)
    const mergedSlopeZSpectrum = this.createEmptySpectrum(this.targetResolution)
    const mergedDispXSpectrum = this.createEmptySpectrum(this.targetResolution)
    const mergedDispZSpectrum = this.createEmptySpectrum(this.targetResolution)
    const mergeddDx_dxSpectrum = this.createEmptySpectrum(this.targetResolution)
    const mergeddDz_dzSpectrum = this.createEmptySpectrum(this.targetResolution)
    const mergeddDx_dzSpectrum = this.createEmptySpectrum(this.targetResolution)
    const mergeddDz_dxSpectrum = this.createEmptySpectrum(this.targetResolution)

    // 合并每一层
    for (const singleLayerSpectrumData of allLayersSpectrumData) {
      // 上采样到目标分辨率
      const upsampledHeight = this.upsampleSpectrum(
        singleLayerSpectrumData.heightSpectrum,
        singleLayerSpectrumData.resolution,
        this.targetResolution
      )
      const upsampledSlopeX = this.upsampleSpectrum(
        singleLayerSpectrumData.slopeXSpectrum,
        singleLayerSpectrumData.resolution,
        this.targetResolution
      )
      const upsampledSlopeZ = this.upsampleSpectrum(
        singleLayerSpectrumData.slopeZSpectrum,
        singleLayerSpectrumData.resolution,
        this.targetResolution
      )
      const upsampledDispX = this.upsampleSpectrum(
        singleLayerSpectrumData.dispXSpectrum,
        singleLayerSpectrumData.resolution,
        this.targetResolution
      )
      const upsampledDispZ = this.upsampleSpectrum(
        singleLayerSpectrumData.dispZSpectrum,
        singleLayerSpectrumData.resolution,
        this.targetResolution
      )
      const upsampleddDx_dx = this.upsampleSpectrum(
        singleLayerSpectrumData.dDx_dxSpectrum,
        singleLayerSpectrumData.resolution,
        this.targetResolution
      )
      const upsampleddDz_dz = this.upsampleSpectrum(
        singleLayerSpectrumData.dDz_dzSpectrum,
        singleLayerSpectrumData.resolution,
        this.targetResolution
      )
      const upsampleddDx_dz = this.upsampleSpectrum(
        singleLayerSpectrumData.dDx_dzSpectrum,
        singleLayerSpectrumData.resolution,
        this.targetResolution
      )
      const upsampleddDz_dx = this.upsampleSpectrum(
        singleLayerSpectrumData.dDz_dxSpectrum,
        singleLayerSpectrumData.resolution,
        this.targetResolution
      )

      // 根据混合模式合并
      const weight =
        cascadeConfig.blendMode === 'weighted' ? singleLayerSpectrumData.amplitude : 1.0
      // const weight = 1

      this.addSpectrumWeighted(mergedHeightSpectrum, upsampledHeight, weight)
      this.addSpectrumWeighted(mergedSlopeXSpectrum, upsampledSlopeX, weight)
      this.addSpectrumWeighted(mergedSlopeZSpectrum, upsampledSlopeZ, weight)
      this.addSpectrumWeighted(mergedDispXSpectrum, upsampledDispX, weight)
      this.addSpectrumWeighted(mergedDispZSpectrum, upsampledDispZ, weight)
      this.addSpectrumWeighted(mergeddDx_dxSpectrum, upsampleddDx_dx, weight)
      this.addSpectrumWeighted(mergeddDz_dzSpectrum, upsampleddDz_dz, weight)
      this.addSpectrumWeighted(mergeddDx_dzSpectrum, upsampleddDx_dz, weight)
      this.addSpectrumWeighted(mergeddDz_dxSpectrum, upsampleddDz_dx, weight)
    }

    return {
      heightSpectrum: mergedHeightSpectrum,
      slopeXSpectrum: mergedSlopeXSpectrum,
      slopeZSpectrum: mergedSlopeZSpectrum,
      dispXSpectrum: mergedDispXSpectrum,
      dispZSpectrum: mergedDispZSpectrum,
      dDx_dxSpectrum: mergeddDx_dxSpectrum,
      dDz_dzSpectrum: mergeddDz_dzSpectrum,
      dDx_dzSpectrum: mergeddDx_dzSpectrum,
      dDz_dxSpectrum: mergeddDz_dxSpectrum
    }
  }

  private fillOutCascadeLayerputArrays(spatialData: SpatialData, time: number) {
    const { heightSpatial, slopeXSpatial, slopeZSpatial, dispXSpatial, dispZSpatial } = spatialData
    const N = this.targetResolution

    const amplitude = 1

    // 提取实部并存储
    let index = 0
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        // Debug Code -- 检查 heightField[index]、displacementX[index]、displacementZ[index] 是否存在，以及 heightField[index] 中的数据是否被写入了 Displacement Texture
        if (__DEBUG__) {
          const x = (i / N) * this.cascadeConfig.meshSize
          const z = (j / N) * this.cascadeConfig.meshSize
          this.heightField[index] = Math.sin(x * 0.1 + time) * Math.sin(z * 0.1 + time) * 5.0
          this.displacementX[index] = 0
          this.displacementZ[index] = 0
          console.log(this.heightField[index])
          console.log(this.displacementX[index], this.displacementZ[index])
        }

        this.heightField[index] = heightSpatial[i][j].real * amplitude
        this.gradX[index] = slopeXSpatial[i][j].real * amplitude
        this.gradZ[index] = slopeZSpatial[i][j].real * amplitude
        this.displacementX[index] = dispXSpatial[i][j].real * amplitude
        this.displacementZ[index] = dispZSpatial[i][j].real * amplitude
        index++
      }
    }

    if (this.printCount < this.printMaxCount) {
      // Debug Code
      // ===== 添加波高统计 =====
      const heights = Array.from(this.heightField)
      const minHeight = Math.min(...heights)
      const maxHeight = Math.max(...heights)

      // 计算 RMS（均方根）
      // const sumSquares = heights.reduce((sum, h) => sum + h * h, 0)
      // const rms = Math.sqrt(sumSquares / heights.length)

      // 有效波高 Hs = 4 * RMS
      // const Hs = 4 * rms

      console.log('=== 波高统计 (时刻 t=' + time.toFixed(2) + 's) ===')
      console.log('最小波高:', minHeight, 'm')
      console.log('最大波高:', maxHeight, 'm')
      // console.log('RMS 波高:', rms, 'm')
      // console.log('有效波高 Hs:', Hs, 'm')
      console.log('波高范围:', maxHeight - minHeight, 'm')

      // 统计梯度范围
      let minGradX = Infinity,
        maxGradX = -Infinity
      let minGradZ = Infinity,
        maxGradZ = -Infinity

      for (let i = 0; i < N * N; i++) {
        minGradX = Math.min(minGradX, this.gradX[i])
        maxGradX = Math.max(maxGradX, this.gradX[i])
        minGradZ = Math.min(minGradZ, this.gradZ[i])
        maxGradZ = Math.max(maxGradZ, this.gradZ[i])
      }

      console.log('梯度 X 范围:', [minGradX, maxGradX])
      console.log('梯度 Z 范围:', [minGradZ, maxGradZ])

      this.printCount++
      console.log(this.printCount, this.printMaxCount)
    }
  }

  // private upsampleSpectrum(spectrum: Complex[][], fromRes: number, toRes: number): Complex[][] {
  //   if (fromRes === toRes) {
  //     return spectrum // 无需上采样
  //   }

  //   const result = this.createEmptySpectrum(toRes)
  //   const ratio = toRes / fromRes

  //   for (let i = 0; i < fromRes; i++) {
  //     for (let j = 0; j < fromRes; j++) {
  //       const targetI = Math.floor(i * ratio)
  //       const targetJ = Math.floor(j * ratio)
  //       if (targetI < toRes && targetJ < toRes) {
  //         result[targetI][targetJ] = spectrum[i][j]
  //       }
  //     }
  //   }

  //   return result
  // }

  private upsampleSpectrum(spectrum: Complex[][], fromRes: number, toRes: number): Complex[][] {
    if (fromRes === toRes) return spectrum

    const result = this.createEmptySpectrum(toRes)
    const scale = fromRes / toRes

    for (let i = 0; i < toRes; i++) {
      for (let j = 0; j < toRes; j++) {
        const srcI = i * scale
        const srcJ = j * scale

        if (srcI < fromRes && srcJ < fromRes) {
          const i0 = Math.floor(srcI)
          const j0 = Math.floor(srcJ)
          // 双线性插值而不是最近邻
          if (i0 + 1 < fromRes && j0 + 1 < fromRes) {
            const fx = srcI - i0
            const fy = srcJ - j0

            result[i][j] = spectrum[i0][j0]
              .multiply(new Complex((1 - fx) * (1 - fy), 0))
              .add(spectrum[i0 + 1][j0].multiply(new Complex(fx * (1 - fy), 0)))
              .add(spectrum[i0][j0 + 1].multiply(new Complex((1 - fx) * fy, 0)))
              .add(spectrum[i0 + 1][j0 + 1].multiply(new Complex(fx * fy, 0)))
          } else {
            result[i][j] = spectrum[i0][j0]
          }
        }
      }
    }
    return result
  }

  private createEmptySpectrum(resolution: number): Complex[][] {
    return Array(resolution)
      .fill(null)
      .map(() =>
        Array(resolution)
          .fill(null)
          .map(() => new Complex(0, 0))
      )
  }

  private addSpectrumWeighted(target: Complex[][], source: Complex[][], weight: number): void {
    for (let i = 0; i < target.length; i++) {
      for (let j = 0; j < target[i].length; j++) {
        target[i][j] = target[i][j].add(source[i][j].multiplyByScalar(weight))
      }
    }
  }

  // =============== getter ===============
  getCascadeConfig(): CascadeConfig {
    return this.cascadeConfig
  }

  // 获取有效的分辨率
  getEffectiveResolution(): number {
    return this.targetResolution
  }

  // 获取有效的大小
  getEffectiveSize(): number {
    return Math.max(...this.cascadeConfig.layerParamsSet.map((layer) => layer.size))
  }

  getCascadeLayers(): CascadeLayerData[] {
    return this.cascadeLayers
  }

  getHeightField(): Float32Array {
    return this.heightField
  }

  getNormalX(): Float32Array {
    return this.gradX
  }

  getNormalZ(): Float32Array {
    return this.gradZ
  }

  getDisplacementX(): Float32Array {
    return this.displacementX
  }

  getDisplacementZ(): Float32Array {
    return this.displacementZ
  }

  getDx_dx(): Float32Array {
    return this.dDx_dx
  }

  getDz_dz(): Float32Array {
    return this.dDz_dz
  }

  getDx_dz(): Float32Array {
    return this.dDx_dz
  }

  getDz_dx(): Float32Array {
    return this.dDz_dx
  }

  // =============== Test Part ===============
  getTestHeightData(
    cascadeLayerData: CascadeLayerData,
    time: number
  ): { heightSpectrum: Complex[][]; heightSpatial: Complex[][] } {
    const cascadeParams = cascadeLayerData.getCascadeLayerParams()
    const N = cascadeParams.resolution
    const L = cascadeParams.size

    /**
     * 初始化频域（k 空间）存储
     * heightSpectrum    : 高度场频谱 η̂(k, t)
     */
    const heightSpectrum: Complex[][] = Array(N)
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
        const h_k_t = this.calculateSingleLayerAmplitudeAtTime(cascadeLayerData, n, m, k, time)

        // 高度谱 η̂(k,t)
        heightSpectrum[n][m] = h_k_t
      }
    }

    const heightSpatial = this.fftProcessor.ifft2DInterface(heightSpectrum)

    return { heightSpectrum, heightSpatial }
  }
}
