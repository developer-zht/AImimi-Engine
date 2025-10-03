import { Complex } from '@/math/Complex'
import { PhillipsSpectrum } from '@/managers/fftOcean/PhillipsSpectrum'
import { JONSWAPSpectrum } from '@/managers/fftOcean/JONSWAPSpectrum'
import { CascadeConfig, CascadeLayerParams } from '@/types/fftOcean'

import { CascadeLayerData } from './CascadeLayerData'
import { Spectrum } from './Spectrum'

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
export class FFTOceanGenerator {
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

  // Debug 次数
  private printCount = 0
  private printMaxCount = 5

  constructor(cascadeConfig: CascadeConfig) {
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
    this.targetResolution = cascadeConfig.targetResolution

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
  async generateOceanSpectrum(time: number): Promise<void> {
    if (!this.cascadeEnabled) {
      const cascadeLayerData = this.cascadeLayers[0]
      // 原始单层处理
      this.updateSingleLayerSpectrum(cascadeLayerData, time)
    } else {
      // Cascade 处理
      this.updateCascadeLayersSpectrum(time)
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

    // h(k,t) = h0(k)*exp(iwt) + h0*(-k)*exp(-iwt)
    const exp_iwt = Complex.expi(omega * time)
    const exp_neg_iwt = Complex.expNegI(omega * time)

    const h0_exp = h0[n][m].multiply(exp_iwt)
    const h0Conj_exp_neg = h0Conj[n][m].multiply(exp_neg_iwt)

    return h0_exp.add(h0Conj_exp_neg)
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
    return this.cascadeConfig.targetSize
  }
}
