import { Complex } from '@/math/Complex'
import { PhillipsSpectrum } from '@/managers/fftOcean/spectrums/PhillipsSpectrum'
import { JONSWAPSpectrum } from '@/managers/fftOcean/spectrums/JONSWAPSpectrum'
import { CascadeConfig, CascadeLayerParams } from '@/types/fftOcean'

import { CascadeLayerData } from './CascadeLayerData'
import { Spectrum } from '@/managers/fftOcean/spectrums/Spectrum'
import { TestSineWaveSpectrum } from '@/managers/fftOcean/spectrums/TestSineSpectrum'

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
export class FFTOceanSpectrumGenerator {
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

  // Debug Code
  private printCount = 0
  private printMaxCount = 5
  private validCount = 0
  private validMaxCount = 1

  private testSineWaveSpectrum: TestSineWaveSpectrum

  constructor(cascadeConfig: CascadeConfig) {
    this.cascadeConfig = cascadeConfig

    this.phillipsSpectrum = new PhillipsSpectrum()
    this.jonswapSpectrum = new JONSWAPSpectrum()

    // Debug Code
    this.testSineWaveSpectrum = new TestSineWaveSpectrum(cascadeConfig.layerParamsSet[0].resolution)

    this.spectrum = this.phillipsSpectrum

    /**
     * cascade 参数配置
     */
    // true 为 cascade，false 为 single
    this.cascadeEnabled = cascadeConfig.enabled
    // 确定目标分辨率
    this.targetResolution = cascadeConfig.meshResolution

    this.initializeCascadeLayers(this.cascadeConfig, this.spectrum)
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
   * 创建空频谱
   * @param resolution 频谱分辨率
   * @returns
   */
  private createEmptySpectrum(resolution: number): Complex[][] {
    return Array(resolution)
      .fill(null)
      .map(() =>
        Array(resolution)
          .fill(null)
          .map(() => new Complex(0, 0))
      )
  }

  /**
   * 主要的海洋更新方法 - 现在支持 cascade
   */
  generateRealTimeOceanSpectrum(time: number): SpectrumData {
    if (!this.cascadeEnabled) {
      const cascadeLayerData = this.cascadeLayers[0]
      // 原始单层处理
      return this.updateSingleLayerSpectrum(cascadeLayerData, time)
    } else {
      // Cascade 处理
      return this.updateCascadeLayersSpectrum(time)
    }
  }

  // =============== Single Layer Calculation ===============
  /**
   * 更新单层海面状态到时间 t
   * 核心公式（频域时间演化）：
   * h(k,t) = h₀(k) * e^(i * ω * t) + h₀*^(-k) * e^(-i * ω * t)
   * 深水色散关系: ω(k) = sqrt(g * |k|)
   */
  private updateSingleLayerSpectrum(
    cascadeLayerData: CascadeLayerData,
    time: number
  ): SpectrumData {
    const cascadeParams = cascadeLayerData.getCascadeLayerParams()
    const N = cascadeParams.resolution

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
        const hktResult = this.calculateSingleLayerAmplitudeAtTime(cascadeLayerData, n, m, k, time)
        const h_k_t = new Complex(hktResult.real, hktResult.imag)
        // 高度谱 η̂(k,t)
        heightSpectrum[n][m] = h_k_t

        if (k <= 10000 && k >= 0.001) {
          /**
           * 水平位移谱（Choppy waves 模型）
           *   d_x(k) = -i * (kx/|k|) * λ * h(k,t)
           *   d_z(k) = -i * (kz/|k|) * λ * h(k,t)
           * λ 是 choppiness 系数，控制水平拉伸程度
           */
          dispXSpectrum[n][m] = h_k_t.multiply(new Complex(0, -kxNorm * cascadeParams.choppiness))
          dispZSpectrum[n][m] = h_k_t.multiply(new Complex(0, -kzNorm * cascadeParams.choppiness))

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
          // const slopeScale = this.params.size / (2.0 * Math.PI)
          // Debug Code
          // console.log(this.params.size / (2.0 * Math.PI))
          slopeXSpectrum[n][m] = h_k_t.multiply(new Complex(0, kx))
          slopeZSpectrum[n][m] = h_k_t.multiply(new Complex(0, kz))
        } else {
          dispXSpectrum[n][m] = new Complex(0, 0)
          dispZSpectrum[n][m] = new Complex(0, 0)
          slopeXSpectrum[n][m] = new Complex(0, 0)
          slopeZSpectrum[n][m] = new Complex(0, 0)
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
        dDz_dzSpectrum[n][m] = dispZSpectrum[n][m].multiply(new Complex(0, kz))
        dDx_dzSpectrum[n][m] = dispXSpectrum[n][m].multiply(new Complex(0, kz))
        dDz_dxSpectrum[n][m] = dispZSpectrum[n][m].multiply(new Complex(0, kx))

        // Displacement Spectrum
        dispXSpectrum[n][m].multiplyByScalar(amplitude)
        heightSpectrum[n][m].multiplyByScalar(amplitude)
        dispZSpectrum[n][m].multiplyByScalar(amplitude)
        // Slope Spectrum
        slopeXSpectrum[n][m].multiplyByScalar(amplitude)
        slopeZSpectrum[n][m].multiplyByScalar(amplitude)
        // Jocabian Spectrum
        dDx_dxSpectrum[n][m].multiplyByScalar(amplitude)
        dDz_dzSpectrum[n][m].multiplyByScalar(amplitude)
        dDx_dzSpectrum[n][m].multiplyByScalar(amplitude)
        dDz_dxSpectrum[n][m].multiplyByScalar(amplitude)
      }
    }

    // Debug Code
    if (this.validCount < this.validMaxCount) {
      // Displacement Spectrum
      // this.checkConjugateSymmetry(dispXSpectrum, 'dispXSpectrum')
      // this.checkConjugateSymmetry(heightSpectrum, 'heightSpectrum')
      // this.checkConjugateSymmetry(dispZSpectrum, 'dispZSpectrum')
      // // Slope Spectrum
      // this.checkConjugateSymmetry(slopeXSpectrum, 'slopeXSpectrum')
      // this.checkConjugateSymmetry(slopeZSpectrum, 'slopeZSpectrum')
      // // Jocabian Spectrum
      // this.checkConjugateSymmetry(dDx_dxSpectrum, 'dDx_dxSpectrum')
      // this.checkConjugateSymmetry(dDz_dzSpectrum, 'dDz_dzSpectrum')
      // this.checkConjugateSymmetry(dDx_dzSpectrum, 'dDx_dzSpectrum')
      // this.checkConjugateSymmetry(dDz_dxSpectrum, 'dDz_dxSpectrum')
      // this.validCount++
    }

    // 生成完后，统一修正 Nyquist
    this.fixNyquistSymmetry(dispXSpectrum, dispZSpectrum, slopeXSpectrum, slopeZSpectrum, N)

    // Debug Code
    if (this.validCount < this.validMaxCount) {
      // Displacement Spectrum
      // this.checkConjugateSymmetry(dispXSpectrum, 'dispXSpectrum')
      // this.checkConjugateSymmetry(heightSpectrum, 'heightSpectrum')
      // this.checkConjugateSymmetry(dispZSpectrum, 'dispZSpectrum')
      // // Slope Spectrum
      // this.checkConjugateSymmetry(slopeXSpectrum, 'slopeXSpectrum')
      // this.checkConjugateSymmetry(slopeZSpectrum, 'slopeZSpectrum')
      // // Jocabian Spectrum
      // this.checkConjugateSymmetry(dDx_dxSpectrum, 'dDx_dxSpectrum')
      // this.checkConjugateSymmetry(dDz_dzSpectrum, 'dDz_dzSpectrum')
      // this.checkConjugateSymmetry(dDx_dzSpectrum, 'dDx_dzSpectrum')
      // this.checkConjugateSymmetry(dDz_dxSpectrum, 'dDz_dxSpectrum')
      this.validCount++
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

      this.printCount++
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

    // 1. 获取  h0 和 h0Conj
    const { h0, h0Conj } = cascadeLayerData.getH0AndH0Conj()

    // const { h0, h0Conj } = this.testSineWaveSpectrum.generateTestH0andH0Conj({
    //   frequency: 2,
    //   direction: 'horizontal',
    //   amplitude: cascadeLayerParams.resolution * cascadeLayerParams.resolution * 0.05 // 合适的振幅
    // })

    // const { h0, h0Conj } = this.testSineWaveSpectrum.getH0andH0Conj()

    // 2. 根据色散关系求解 ω
    // 色散关系：深水波
    const omega = Math.sqrt(cascadeLayerParams.gravity * k)

    // 3. 计算 h(k,t) = h0(k)*exp(iwt) + h0*(-k)*exp(-iwt)
    const exp_iwt = Complex.expi(omega * time)
    const exp_neg_iwt = Complex.expNegI(omega * time)

    // 对于任意 (n, m)
    const h0_k = h0[n][m] // h0(k)
    // h0*(-k) 在数组中的位置
    // const n_minus = (N - n) % N
    // const m_minus = (N - m) % N
    // let h0_conj_minus_k = h0[n_minus][m_minus] // h0*(-k)
    const h0_conj_minus_k = h0Conj[n][m] // h0*(-k)
    // Debug Code
    // if (h0_k.imag !== h0_conj_minus_k.imag && this.printCount < this.printMaxCount + 10) {
    //   console.log(h0_k.imag, h0_conj_minus_k.imag)
    //   this.printCount++
    // }

    const h0_k_exp = h0_k.multiply(exp_iwt)
    const h0_conj_minus_k_exp_neg = h0_conj_minus_k.multiply(exp_neg_iwt)

    const h_k_t = h0_k_exp.add(h0_conj_minus_k_exp_neg)

    // Debug Code
    // if (Math.abs(h_k_t.imag) > 1e-10) {
    //   console.warn(`非实数结果: real=${h_k_t.real}, imag=${h_k_t.imag}`)
    // }

    // return h0_k
    // return h0_conj_minus_k
    return h_k_t
  }

  // =============== Cascade Layers Calculation ===============
  private updateCascadeLayersSpectrum(time: number): SpectrumData {
    const cascadeConfig = this.cascadeConfig
    const layerSpectrumArray = this.generateAllCascadeLayersData(time)

    // 合并所有层
    const mergedSpectrum = this.mergeLayersSpectrum(layerSpectrumArray, cascadeConfig)

    return mergedSpectrum
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

  // =============== Helper ===============
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

  private addSpectrumWeighted(target: Complex[][], source: Complex[][], weight: number): void {
    for (let i = 0; i < target.length; i++) {
      for (let j = 0; j < target[i].length; j++) {
        target[i][j] = target[i][j].add(source[i][j].multiplyByScalar(weight))
      }
    }
  }

  private checkConjugateSymmetry(spectrum: Complex[][], name: string): void {
    const N = spectrum.length
    let count = 0
    console.log(`===== 开始: 检验 ${name} 共轭对称性 =====`)
    for (let n = 0; n < N; n++) {
      for (let m = 0; m < N; m++) {
        const n_neg = (N - n) % N
        const m_neg = (N - m) % N
        const conj = new Complex(spectrum[n_neg][m_neg].real, -spectrum[n_neg][m_neg].imag)

        const diff_real = Math.abs(spectrum[n][m].real - conj.real)
        const diff_imag = Math.abs(spectrum[n][m].imag - conj.imag)
        const magnitude = Math.sqrt(diff_real ** 2 + diff_imag ** 2)

        if (diff_real > 1e-10 || diff_imag > 1e-10 || magnitude > 1e-10) {
          console.log(`非共轭对称 at (${n},${m}): ${spectrum[n][m]}`)
          count++
        }
      }
    }
    console.log(`不对称点个数: ${count}`)
    console.log(`===== 结束: ${name} 共轭对称性检验完毕 =====`)
  }

  // 修正 Nyquist 频率点上的不共轭对称
  private fixNyquistSymmetry(
    dispX: Complex[][],
    dispZ: Complex[][],
    slopeX: Complex[][],
    slopeZ: Complex[][],
    N: number
  ): void {
    const half = N / 2

    // ========== 修正 n=64 行（x方向Nyquist）==========
    for (let m = 0; m < N; m++) {
      const m_mirror = (N - m) % N

      // dispX 和 slopeX 在 n=64 行需要共轭对称
      this.makeConjugatePair(dispX, half, m, half, m_mirror)
      this.makeConjugatePair(slopeX, half, m, half, m_mirror)

      // dispZ 和 slopeZ 也需要（虽然是z方向，但仍需要整体对称）
      this.makeConjugatePair(dispZ, half, m, half, m_mirror)
      this.makeConjugatePair(slopeZ, half, m, half, m_mirror)
    }

    // ========== 修正 m=64 列（z方向Nyquist）==========
    for (let n = 0; n < N; n++) {
      const n_mirror = (N - n) % N

      this.makeConjugatePair(dispX, n, half, n_mirror, half)
      this.makeConjugatePair(dispZ, n, half, n_mirror, half)
      this.makeConjugatePair(slopeX, n, half, n_mirror, half)
      this.makeConjugatePair(slopeZ, n, half, n_mirror, half)
    }

    // ========== 修正 n=0 行（DC行）==========
    for (let m = 0; m < N; m++) {
      const m_mirror = (N - m) % N
      this.makeConjugatePair(dispX, 0, m, 0, m_mirror)
      this.makeConjugatePair(dispZ, 0, m, 0, m_mirror)
      this.makeConjugatePair(slopeX, 0, m, 0, m_mirror)
      this.makeConjugatePair(slopeZ, 0, m, 0, m_mirror)
    }

    // ========== 修正 m=0 列（DC列）==========
    for (let n = 0; n < N; n++) {
      const n_mirror = (N - n) % N
      this.makeConjugatePair(dispX, n, 0, n_mirror, 0)
      this.makeConjugatePair(dispZ, n, 0, n_mirror, 0)
      this.makeConjugatePair(slopeX, n, 0, n_mirror, 0)
      this.makeConjugatePair(slopeZ, n, 0, n_mirror, 0)
    }

    // ========== 强制角点为实数 ==========
    const corners = [
      [0, 0],
      [0, half],
      [half, 0],
      [half, half]
    ]
    for (const [n, m] of corners) {
      dispX[n][m].imag = 0
      dispZ[n][m].imag = 0
      slopeX[n][m].imag = 0
      slopeZ[n][m].imag = 0
    }
  }

  // 修正 Nyquist 频率点上的不共轭对称所需的辅助函数
  private makeConjugatePair(
    spectrum: Complex[][],
    n1: number,
    m1: number,
    n2: number,
    m2: number
  ): void {
    // 如果是同一个点，强制为实数
    if (n1 === n2 && m1 === m2) {
      spectrum[n1][m1].imag = 0
      return
    }

    // 否则强制共轭对称
    const avgReal = (spectrum[n1][m1].real + spectrum[n2][m2].real) / 2
    const avgImag = (spectrum[n1][m1].imag - spectrum[n2][m2].imag) / 2

    spectrum[n1][m1].real = avgReal
    spectrum[n1][m1].imag = avgImag
    spectrum[n2][m2].real = avgReal
    spectrum[n2][m2].imag = -avgImag
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
    return this.cascadeConfig.meshSize
  }
}
