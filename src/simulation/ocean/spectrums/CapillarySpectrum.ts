import { OceanParams } from '../fft/types/OceanParams'
import { Spectrum } from './Spectrum'

/**
 * 毛细波谱（Capillary Wave Spectrum）
 *
 * 补充高频细节，模拟表面张力主导的微小波纹。
 *
 * 物理背景：
 * - 毛细波色散关系: ω = √(gk + σk³/ρ)
 *   σ = 0.074 N/m（水的表面张力系数）
 *   ρ = 1000 kg/m³（水密度）
 * - 当 k > 1 rad/m 时毛细效应才显著
 * - 使用指数衰减 exp(-k/k_cutoff) 限制超高频
 * - capillaryFactor/(gravityFactor+capillaryFactor) 平滑过渡：
 *   低 k → 0（不干扰重力波），高 k → 1（完全由表面张力主导）
 */
export class CapillarySpectrum implements Spectrum {
  /** 基础振幅 */
  private readonly baseAmplitude = 0.001
  /** 截止波数 (rad/m) */
  private readonly cutoffWavenumber = 100

  calculateH0Magnitude(kx: number, kz: number, params: OceanParams): number {
    const k = Math.sqrt(kx * kx + kz * kz)

    // 低于 1 rad/m 不考虑毛细波
    if (k < 1) return 0

    const surfaceTension = 0.074 // N/m
    const waterDensity = 1000 // kg/m³

    // 毛细效应占比: σk³/ρ vs gk
    const capillaryFactor = (surfaceTension * k * k * k) / waterDensity
    const gravityFactor = params.gravity * k

    return (
      this.baseAmplitude *
      Math.exp(-k / this.cutoffWavenumber) *
      (capillaryFactor / (gravityFactor + capillaryFactor))
    )
  }
}
