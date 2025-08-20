interface WindDirection {
  x: number
  y: number
}

export interface OceanParams {
  size: number // 海面片元尺寸（米）
  resolution: number // 网格分辨率（必须是2的幂）
  windSpeed: number // 风速 (m/s)
  windDirection: WindDirection // 风向（归一化）
  gravity: number // 重力加速度
  choppiness: number // 波浪尖锐度
  depth?: number // 水深（可选，用于有限深度）
}

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
  // Phillips常数
  private A = 0.5
  constructor() {}

  calculate(kx: number, kz: number, params: OceanParams): number {
    // k = sqrt(kx^2 + kz^2)
    const k = Math.sqrt(kx * kx + kz * kz)
    // 避免 k=0
    if (k < 0.000001) return 0

    // 最大波长 L = (U^2) / g
    // U: 风速, g: 重力加速度
    const L = (params.windSpeed * params.windSpeed) / params.gravity

    // 波向量方向 k_hat = k / |k|
    const kNorm = { x: kx / k, y: kz / k }

    // 与风向的点积 k_hat · w_hat
    const kDotWind = kNorm.x * params.windDirection.x + kNorm.y * params.windDirection.y

    /** Phillips 波谱公式：
     * const phillips = ((this.A * Math.exp(-1.0 / (k * L) ** 2)) / k ** 4) * kDotWind ** 2
     * - 其中：
     *   this.A -> Phillips常数
     *   Math.exp(-1.0 / Math.pow(k * L, 2))) -> exp(-1 / (kL)^2)
     *   Math.pow(k, 4)) -> k^-4
     *   Math.pow(kDotWind, 2) -> (k_hat · w_hat)^2
     * - 如果 kDotWind < 0 则为逆风波，此时可将 phillips 设为 0 返回
     */
    const phillips =
      ((this.A * Math.exp(-1.0 / Math.pow(k * L, 2))) / Math.pow(k, 4)) * Math.pow(kDotWind, 2)

    // 抑制逆风波
    return kDotWind < 0 ? 0 : phillips
  }
}
