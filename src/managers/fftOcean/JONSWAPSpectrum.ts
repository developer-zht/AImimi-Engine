import { OceanParams } from '@/managers/fftOcean/PhillipsSpectrum'

export class JONSWAPSpectrum {
  private A = 0.008 // Phillips常数
  private gamma = 3.3 // 峰值增强因子
  private sigma_a = 0.07 // 低频端宽度参数
  private sigma_b = 0.09 // 高频端宽度参数

  // 计算峰值频率
  private calculatePeakFrequency(params: OceanParams): number {
    // 根据风速计算峰值频率
    // ωp = 0.877 * g / U19.5 (其中 U19.5 是 19.5m 高度风速)
    // ωp = 22 * g * g / U10 * U10 (其中 U10 是 10m 高度风速)
    return (0.877 * params.gravity) / params.windSpeed
  }

  // 计算峰值增强因子
  private calculateGammaFactor(omega: number, omegaPeak: number, gammaParam: number): number {
    const sigma = omega <= omegaPeak ? this.sigma_a : this.sigma_b
    const r = Math.exp(
      -Math.pow(omega - omegaPeak, 2) / (2 * sigma * sigma * omegaPeak * omegaPeak)
    )
    return Math.pow(gammaParam, r)
  }

  // 方向分布函数
  private directionFactor(
    kx: number,
    kz: number,
    params: OceanParams,
    omega: number,
    omegaPeak: number
  ): number {
    const k = Math.sqrt(kx * kx + kz * kz)
    if (k < 0.000001) return 0

    const kNorm = { x: kx / k, y: kz / k }
    const kDotWind = kNorm.x * params.windDirection.x + kNorm.y * params.windDirection.y

    // Mitsuyasu 分布: D(θ, ω) = (2 / π) * cos^(2 * s(ω))( θ / 2 ),   |θ| ≤ π
    // 夹角 θ
    const theta = Math.acos(Math.min(Math.max(kDotWind, -1), 1))
    // s(ω) 参数 (频率相关方向性指数) = 11.5 * ( ω / ωp )^(-2.5)
    const s = 11.5 * Math.pow(omega / omegaPeak, -2.5)
    // D(θ, ω) = (2 / π) * cos^(2 * s(ω))( θ / 2 ),   |θ| ≤ π
    const D = (2 / Math.PI) * Math.pow(Math.cos(theta / 2), 2 * s)

    return D
    // return kDotWind < 0 ? 0 : Math.pow(kDotWind, 2)
  }

  calculate(kx: number, kz: number, params: OceanParams): number {
    const k = Math.sqrt(kx * kx + kz * kz)
    if (k < 0.000001) return 0

    // 转换到频率域
    const omega = Math.sqrt(params.gravity * k)
    const omegaPeak = this.calculatePeakFrequency(params)

    // JONSWAP公式：基于Phillips谱 + 峰值增强
    const phillipsBase = (this.A * Math.pow(params.gravity, 2)) / Math.pow(omega, 5)
    const exponential = Math.exp(-1.25 * Math.pow(omegaPeak / omega, 4))

    // 峰值增强因子 γ
    const gamma = this.calculateGammaFactor(omega, omegaPeak, this.gamma)

    // 使用 Mitsuyasu 方向分布
    const D = this.directionFactor(kx, kz, params, omega, omegaPeak)

    return phillipsBase * exponential * gamma * D
  }
}
