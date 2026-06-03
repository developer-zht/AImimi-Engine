import { OceanParams } from '../fft/types/OceanParams'
import { Spectrum } from './Spectrum'

/**
 * Phillips 波谱
 *
 * 基础公式：
 *   P(k) = A · exp(-1/(kL)²) / k⁴ · |k̂ · ŵ|
 *
 * 其中：
 *   k = √(kx² + kz²)          波向量模长
 *   L = U² / g                 最大波长（U: 风速, g: 重力加速度）
 *   k̂ = k / |k|               波向量单位方向
 *   ŵ                          风向单位向量
 *   |k̂ · ŵ|                   方向分布（使用绝对值而非平方，对侧向波保留更多能量）
 *   exp(-1/(kL)²)              抑制波长远大于 L 的波
 *   k⁻⁴                       高频衰减
 *
 * 逆风波处理：
 *   当 k̂ · ŵ < 0（逆风方向）时，乘以衰减系数 damping 而非直接置零，
 *   允许少量逆风波存在以增加真实感。
 */
export class PhillipsSpectrum implements Spectrum {
  /**
   * Phillips 常数 A，控制整体波浪强度
   *
   *   0.002  很弱的波浪
   *   0.005  轻微波浪
   *   0.008  标准波浪 <= 推荐起始值
   *   0.015  较强波浪
   *   0.025  很强的波浪
   */
  private readonly A: number

  /** 逆风波衰减系数（0 = 完全抑制，1 = 不衰减） */
  private readonly damping: number

  constructor(A: number = 0.008, damping: number = 0.3) {
    this.A = A
    this.damping = damping
  }

  /**
   * 计算 Phillips 谱值 P(k)
   */
  private calculatePk(kx: number, kz: number, params: OceanParams): number {
    const k2 = kx * kx + kz * kz
    if (k2 < 1e-6) return 0
    const k = Math.sqrt(k2)

    const L = (params.windSpeed * params.windSpeed) / params.gravity

    // 归一化风向
    const windLen = Math.sqrt(params.windDirection.x ** 2 + params.windDirection.y ** 2)
    const wx = params.windDirection.x / windLen
    const wy = params.windDirection.y / windLen

    // 波向量与风向的夹角余弦
    const kxNorm = kx / k
    const kzNorm = kz / k
    const kw = kxNorm * wx + kzNorm * wy

    // P(k) = A · exp(-1/(kL)²) · |k̂·ŵ| / k⁴
    const phillips = (this.A * Math.exp(-1 / (k2 * L * L)) * Math.abs(kw)) / (k2 * k2)

    // 逆风波衰减
    return phillips * (kw < 0 ? this.damping : 1.0)
  }

  calculateH0Magnitude(kx: number, kz: number, params: OceanParams): number {
    const L = params.size
    const P = this.calculatePk(kx, kz, params) * ((4 * Math.PI * Math.PI) / (L * L))
    return Math.sqrt(P / 2)
  }
}
