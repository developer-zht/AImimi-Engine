import { CascadeLayerParams } from '@/types/fftOcean'
import { Spectrum } from '@/managers/fftOcean/spectrums/Spectrum'

export class CapillarySpectrum implements Spectrum {
  private baseAmplitude = 0.001 // 基础振幅
  private cutoffWavenumber = 100 // 截止波数 (rad/m)

  calculateH0Magnitude(kx: number, kz: number, params: CascadeLayerParams): number {
    const k = Math.sqrt(kx * kx + kz * kz)

    // 毛细波色散关系：ω = sqrt(gk + σk³/ρ)
    // σ = 表面张力系数，ρ = 水密度
    const surfaceTension = 0.074 // N/m
    const waterDensity = 1000 // kg/m³

    const omega = Math.sqrt(params.gravity * k + (surfaceTension * k * k * k) / waterDensity)

    // 高频范围的指数衰减 + 表面张力效应
    const capillaryFactor = (surfaceTension * Math.pow(k, 3)) / waterDensity
    const gravityFactor = params.gravity * k

    // 只在高频范围生效
    if (k < 1) return 0 // 低于 1rad/m 不考虑毛细波

    // 高频范围的指数衰减
    // return this.baseAmplitude * Math.exp(-k / this.cutoffWavenumber)

    return (
      this.baseAmplitude *
      Math.exp(-k / this.cutoffWavenumber) *
      (capillaryFactor / (gravityFactor + capillaryFactor))
    )

    // return this.baseAmplitude * Math.exp(- ((k / this.cutoffWavenumber) ** 2)) * (capillaryFactor / (gravityFactor + capillaryFactor))
  }
}
