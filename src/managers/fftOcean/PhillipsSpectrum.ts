import { OceanParams } from '@/types/fftOcean'

/** Phillips 波谱公式：
 * P(k) = A * exp(-(1 / (kL)^2)) / k^4 * ( (k_hat · w_hat)^2 )
 * - 其中：
 *   k = sqrt(kx^2 + kz^2)      // 波向量模长
 *   L = (U^2) / g              // 最大波长（U: 风速, g: 重力加速度）
 *   k_hat = k / |k|            // 波向量单位方向
 *   w_hat                      // 风向单位向量
 *   k_hat · w_hat              // 波向量与风向的夹角余弦
 *   exp(-1/(kL)^2)             // 长波抑制
 *   k^-4                       // 短波衰减
 *   (k_hat · w_hat)^2          // 方向性分布
 * - 如果 (k_hat · w_hat < 0) 则表示逆风波，此时可将 P(k) 设为 0   // 抑制逆风波
 */
export class PhillipsSpectrum {
  /* Phillips 常数，影响整体幅度，如果太小，高频会被过度压制
      很弱的波浪 A = 0.002 
      轻微波浪   A = 0.005  
      标准波浪   A = 0.008 ⭐推荐起始值
      较强波浪   A = 0.015
      很强的波浪 A = 0.025 
  */
  private A = 0.008
  constructor() {}

  calculate(kx: number, kz: number, params: OceanParams): number {
    // k = sqrt(kx^2 + kz^2) 决定了高频的存在范围(影响小波长波)
    const k = Math.sqrt(kx * kx + kz * kz)
    // 避免 k=0
    if (k < 0.0001) return 0

    // 最大波长 L = (U^2) / g
    // U: 风速, g: 重力加速度
    const L = (params.windSpeed * params.windSpeed) / params.gravity

    // 波向量方向 k_hat = k / |k|
    const kNorm = { x: kx / k, y: kz / k }

    // 与风向的点积 k_hat · w_hat
    // const kDotWind = kNorm.x * params.windDirection.x + kNorm.y * params.windDirection.y

    // 归一化风向向量
    const windLength = Math.sqrt(
      params.windDirection.x * params.windDirection.x +
        params.windDirection.y * params.windDirection.y
    )
    const windNorm = {
      x: params.windDirection.x / windLength,
      y: params.windDirection.y / windLength
    }

    // 使用归一化后的风向
    const kDotWind = kNorm.x * windNorm.x + kNorm.y * windNorm.y

    /** Phillips 波谱公式：
     * const phillips = ((this.A * Math.exp(-1.0 / (k * L) ** 2)) / k ** 4) * kDotWind ** 2
     * (or const phillips = ((this.A * Math.exp(-1.0 / (k * L) ** 2)) / k ** 4) * kDotWind ** 6)
     * - 其中：
     *   this.A -> Phillips常数
     *   Math.exp(-1.0 / Math.pow(k * L, 2))) -> exp(-1 / (kL)^2)
     *   Math.pow(k, 4)) -> k^-4 快速衰减高频
     *   Math.pow(kDotWind, 2) -> (k_hat · w_hat)^2
     * - 如果 kDotWind < 0 则为逆风波，此时可将 phillips 设为 0 返回
     */
    // const phillips =
    //   ((this.A * Math.exp(-1.0 / Math.pow(k * L, 2))) / Math.pow(k, 4)) * Math.pow(kDotWind, 2)

    const kL = k * L
    const phillips =
      ((this.A * Math.exp(-1.0 / (kL * kL))) / Math.pow(k, 4)) * Math.pow(kDotWind, 2)

    // Debug Code
    // if (__DEBUG__) {
    //   if (k > 1.0) {
    //     console.log(k)
    //     console.log(
    //       `Phillips debug: k=${k.toFixed(4)}, L=${L.toFixed(2)}, kL=${kL.toFixed(4)}, P=${phillips.toFixed(6)}`
    //     )
    //   }
    // }

    if (kDotWind < 0) {
      // 抑制逆风波
      return 0
    } else if (k > 1) {
      // 对高频增强: 高频波数 > 1 时增强
      // return phillips * 2
      const k_cutoff = 2.0
      return phillips * Math.exp(-(k / k_cutoff) * (k / k_cutoff))
    } else {
      return phillips
    }

    // return kDotWind < 0 ? 0 : k > 1.0 ? phillips * 2 : phillips
    // return phillips
  }

  calculateH0Magnitude(kx: number, kz: number, params: OceanParams): number {
    const P = this.calculate(kx, kz, params)

    // h0_magnitude = sqrt(P/2)
    const h0Magnitude = Math.sqrt(P / 2)

    return h0Magnitude
  }
}
