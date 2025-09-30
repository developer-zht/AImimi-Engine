import { OceanParams } from '@/types/fftOcean'
import { Spectrum } from './Spectrum'

/**
 * From https://geo.libretexts.org/Bookshelves/Oceanography
 * From https://www.bilibili.com/video/BV1k18GzNEXF/?buvid=Y447BC45F366D0A44BF4A0B10D7009331C78&is_story_h5=false&mid=0QRtj1fBR22j29mQPj4UGA%3D%3D&plat_id=116&share_from=ugc&share_medium=iphone&share_plat=ios&share_source=COPY&share_tag=s_i&timestamp=1753179515&unique_k=yq2b71g&up_id=386284643&vd_source=1230a6ade32714ddfa832a8be97fa889&spm_id_from=333.788.videopod.sections
 *
 * 非方向性频率函数部分
 * [公式1] JONSWAP谱核心公式: S(ω) = (αg²/ω⁵) · e^(-5/4·(ωp/ω)⁴) · γ^r
 * [公式2] 峰值增强指数 r: r = e^(-(ω-ωp)²/(2σ²ωp²))
 * [公式3] gamma峰值增强因子: γ = 3.3
 * [公式4] alpha参数（Phillips常数）: α = 0.076 · (U²/Fg)^(-0.22)
 * [公式5] 峰值频率: ωp = 22 · g²/(UF)
 * [公式6] sigma宽度参数:
 *  σ = { 0.07  当 ω ≤ ωp
 *      { 0.09  当 ω > ωp
 * [公式7] 频率依赖函数（深水修正）:
 * Φ(ωh) = { 0.5·ωh²      当 ωh ≤ 1
 *         { 1 - 0.5·ωh²  当 ωh > 1
 * [公式8] JONSWAP深水频谱: J = S(ω) · Φ(ωh)
 *
 *
 * 方向性频谱部分
 * [公式9] 完整方向性频谱: spec = J · Dξ(ω,θ) · swave
 * [公式10] 频率导数（色散关系导数）: F = g · { (d·|k|)/cosh²(d·|k|) + tanh[min(20, d·|k|)] }
 * [公式11] 初始频率幅度: h(0,k) = Noise.xy · √(2 · spec·|F|/|k| · 4π²/LengthScale²)
 *
 * 哈塞尔曼方向扩展
 * [公式12] 方向性指数 s: s = sp(ω, ωp) + sξ
 * [公式13] sp的分段定义:
 * sp(ω, ωp) = { 9.77·(ω/ωp)^(-2.5)  若 ω ≤ ωp
 *             { 6.97·(ω/ωp)^5       若 ω > ωp
 * [公式14] 涌浪项 sξ: sξ = 16·tanh(ωp/ω) · ξ²
 * [公式15] 方向分布函数 Dξ: Dξ(ω,θ) = Normalize(s)|cos(θ/2)|^(2s)
 * [公式16] 角度计算: θ = atan2(k.y, k.x)
 *
 *
 * 短波过滤
 * [公式17] 短波衰减因子: swave(k,f) = exp(-(f|k|)²)
 * [公式18] 衰减系数: f = 0.01
 */
export class JONSWAPSpectrum implements Spectrum {
  // ========== 基础参数 ==========
  private gamma = 3.3 // 峰值增强因子 γ [公式3]
  private sigma_a = 0.07 // 低频端宽度参数 σ [公式6]
  private sigma_b = 0.09 // 高频端宽度参数 σ [公式6]

  // ========== 非方向性频率函数(Non-directional Frequency Spectrum) ==========
  /**
   * 计算 Phillips 常数 α（修正版）
   * α = 0.076 * (U₁₀²/Fg)^(0.22)  ← 注意是正指数！
   *
   * @param windSpeed U₁₀ - 10 米高度风速 (m/s)
   * @param fetch F - 风区距离 (m)
   * @param gravity g - 重力加速度 (m/s²)
   * @returns Phillips常数 α
   */
  private calculateAlpha(windSpeed: number, fetch: number, gravity: number): number {
    // U₁₀²/Fg 是无量纲参数
    const dimensionlessParam = (windSpeed * windSpeed) / (fetch * gravity)

    // ✅ 修正：指数改为 +0.22（不是 -0.22）
    // fetch越大 → dimensionlessParam越小 → α越小（能量集中在低频）
    return 0.076 * Math.pow(dimensionlessParam, 0.22)
  }

  /**
   * 计算峰值角频率 ωp
   * ωp = 22 * (g²/(U₁₀F))^(1/3)  ← 注意1/3次方！
   *
   * 注意: 这个公式考虑了fetch的影响
   * - fetch小(受限风区) → ωp大 → 波长短
   * - fetch大(开阔海域) → ωp小 → 波长长
   *
   * @param params 海洋参数
   * @returns 峰值角频率 ωp (rad/s)
   */
  private calculatePeakFrequency(params: OceanParams): number {
    const fetch = params.fetch || ((params.windSpeed * params.windSpeed) / params.gravity) * 1000

    // 完整公式: ωp = 22 * (g² / (U₁₀ * F))^(1/3)
    const dimensionlessPeak = (params.gravity * params.gravity) / (params.windSpeed * fetch)

    const omegaPeak = 22 * Math.pow(dimensionlessPeak, 1 / 3)

    // console.log('omegaPeak:', omegaPeak)

    // 如果没有fetch参数,使用简化公式: ωp = 0.877 g / U
    // return (0.877 * params.gravity) / params.windSpeed

    return omegaPeak
    // return 0.1
  }

  /**
   * 计算峰值增强因子 γ^r
   * r = exp(-(ω-ωp)² / (2σ²ωp²))
   *
   * 这是一个高斯型峰值增强,使JONSWAP谱在峰值频率附近更尖锐
   *
   * @param omega 当前角频率 ω
   * @param omegaPeak 峰值角频率 ωp
   * @param gammaParam gamma参数 γ
   * @returns γ^r
   */
  private calculateGammaFactor(omega: number, omegaPeak: number, gammaParam: number): number {
    /**
     * [公式6] 根据频率选择σ值
     * σ = 0.07, if ω ≤ ωp
     * σ = 0.09, if ω > ωp
     */
    const sigma = omega <= omegaPeak ? this.sigma_a : this.sigma_b

    // [公式2] 计算指数 r
    // r = exp(-(ω-ωp)² / (2σ²ωp²))
    const r = Math.exp(
      -Math.pow(omega - omegaPeak, 2) / (2 * sigma * sigma * omegaPeak * omegaPeak)
    )

    // 返回 γ^r
    // 当 ω = ωp 时, r = 1, γ^r = γ = 3.3 (最大增强)
    // 当 ω 远离 ωp 时, r → 0, γ^r → 1 (无增强)
    return Math.pow(gammaParam, r)
  }

  /**
   * 计算JONSWAP波谱 S(ω)
   * S(ω) = (αg²/ω⁵) * exp(-5/4*(ωp/ω)⁴) * γ^r
   *
   * @param kx 波向量x分量
   * @param kz 波向量z分量
   * @param params 海洋参数
   * @returns S(ω) 频谱密度 (m²·s)
   */
  calculateSOmega(kx: number, kz: number, params: OceanParams): number {
    const k = Math.sqrt(kx * kx + kz * kz)
    if (k < 0.000001) return 0

    // 深水色散关系: ω = √(gk)
    const omega = Math.sqrt(params.gravity * k)
    // ✅ 使用修正后的峰值频率计算
    const omegaPeak = this.calculatePeakFrequency(params)

    // ✅ 使用修正后的alpha计算
    // 计算α (如果没有fetch,退化为Phillips常数)
    const fetch = params.fetch || ((params.windSpeed * params.windSpeed) / params.gravity) * 1000
    const alpha = this.calculateAlpha(params.windSpeed, fetch, params.gravity)

    // [公式1] JONSWAP谱基础项
    // Phillips谱形式: (αg²)/ω⁵
    const phillipsBase = (alpha * Math.pow(params.gravity, 2)) / Math.pow(omega, 5)

    // 指数衰减项: exp(-5/4 * (ωp/ω)⁴)
    // -5/4 = -1.25, 但要确保使用正确的系数
    const exponential = Math.exp(-1.25 * Math.pow(omegaPeak / omega, 4))

    // [公式2] 峰值增强因子 γ^r
    const gammaFactor = this.calculateGammaFactor(omega, omegaPeak, this.gamma)

    // 组合得到非方向性频谱 S(ω)
    const S_omega = phillipsBase * exponential * gammaFactor

    return S_omega
  }

  // ========== 频率依赖函数 (Frequency-dependent Function) ==========
  /**
   * 深水频率依赖函数 Φ(ωh)
   * 用于修正深水/浅水效应
   *
   * @param omega 角频率 ω
   * @param depth 水深 d
   * @param gravity 重力加速度 g
   * @returns Φ(ωh) 修正因子
   */
  private calculateDepthFactor(omega: number, depth: number, gravity: number): number {
    // ωh = ω * sqrt(d/g) 是无量纲频率参数
    const omega_h = omega * Math.sqrt(depth / gravity)

    let phi: number = 0
    // [公式7]
    if (omega_h <= 1) {
      phi = 0.5 * omega_h * omega_h
    } else if (omega_h < 2) {
      phi = 1 - 0.5 * Math.pow(2 - omega_h, 2)
    } else {
      phi = 1.0 // ✅ 深水不衰减
    }

    return phi
  }

  /**
   * JONSWAP 深水频谱的 TMA 矫正 J = S(ω) · Φ(ωh)
   * 这里把 S(ω)（非方向性）和 Φ 相乘，返回 J（只是频率方向无向的能量项）
   *
   * @param omega 角频率 ω
   * @param depth 水深 d
   * @param gravity 重力加速度 g
   * @returns J = S(ω) · Φ(ωh)
   */
  private calculateSOmegaTMACorrection(kx: number, kz: number, params: OceanParams): number {
    const k = Math.sqrt(kx * kx + kz * kz)
    if (k < 0.000001) return 0

    // 深水色散关系: ω = √(gk)
    const omega = Math.sqrt(params.gravity * k)

    // S(ω) = (α g^2 / ω^5) * exp(-5/4 (ωp/ω)^4) * γ^r
    const S_omega = this.calculateSOmega(kx, kz, params) // 非方向性谱 S(ω)
    // console.log('S_omega', S_omega)

    // Φ(ωh) 修正
    const phi =
      params.depth && params.depth > 0 && params.depth < 50
        ? this.calculateDepthFactor(omega, params.depth, params.gravity)
        : 1.0

    const SOmegaTMA = S_omega * phi // [公式8]

    return SOmegaTMA
  }

  // ========== 方向扩展 (Directional Spreading) ==========
  /**
   * [Hasselmann 1980] 计算方向扩散指数 s
   *
   * @param omega 当前角频率
   * @param omegaPeak 峰值角频率
   * @param xi 风浪-涌浪混合参数（默认0）
   * @returns 方向扩散指数 s
   */
  private calculateDirectionalSpreading(omega: number, omegaPeak: number, xi: number = 0): number {
    // s_p: 主要频率依赖项（分段函数）
    let sp: number = 0
    if (omega <= omegaPeak) {
      // 低频段: s_p = 9.77 * (ω/ωₚ)^(-2.5)
      sp = 9.77 * Math.pow(omega / omegaPeak, -2.5)
    } else {
      // 高频段: s_p = 6.97 * (ω/ωₚ)^5
      sp = 6.97 * Math.pow(omega / omegaPeak, 5)
    }

    // s_ξ: 风浪-涌浪混合项
    // s_ξ = 16*tanh(ωₚ/ω) + ξ²
    const s_xi = 16 * Math.tanh(omegaPeak / omega) + xi * xi

    // 总扩散指数
    const s = sp + s_xi

    return s
  }

  /**
   * [公式] 归一化系数 C(s)
   * 确保 ∫D(θ)dθ = 1
   *
   * 对于 D(θ) = C(s) * |cos(θ/2)|^(2s)
   * 积分得: C(s) = Γ(s+1) / [√π * Γ(s+1/2)]
   *
   * 使用数值逼近或查找表
   */
  private normalizationFactor(s: number): number {
    // 方法1: 使用 Gamma 函数（需要引入数学库）
    // return gamma(s + 1) / (Math.sqrt(Math.PI) * gamma(s + 0.5))

    // 方法2: 数值积分（更稳健）
    const N_SAMPLES = 100
    let integral = 0
    for (let i = 0; i < N_SAMPLES; i++) {
      const theta = -Math.PI + (2 * Math.PI * i) / N_SAMPLES
      integral += Math.pow(Math.abs(Math.cos(theta / 2)), 2 * s)
    }
    integral *= (2 * Math.PI) / N_SAMPLES

    return 1 / integral

    // 方法3: 经验公式近似（最快）
    // 对于 s ∈ [1, 100]，误差 < 2%
    // return (2 / Math.PI) * Math.pow(2, s) * Math.exp(lgamma(s + 1) - lgamma(s + 0.5) - 0.5*Math.log(Math.PI))
  }

  /**
   * [完整版]  Hasselmann 方向分布函数 D_ξ(θ, ω)
   *
   * @param kx 波向量 x 分量
   * @param kz 波向量 z 分量
   * @param params 海洋参数
   * @param omega 当前角频率
   * @param omegaPeak 峰值角频率
   * @returns 方向分布因子 D_ξ(θ, ω)
   */
  private directionHasselmannFactor(
    kx: number,
    kz: number,
    params: OceanParams,
    omega: number,
    omegaPeak: number
  ): number {
    const k = Math.sqrt(kx * kx + kz * kz)
    if (k < 0.000001) return 0

    // 1.计算波的绝对传播方向
    const theta_wave = Math.atan2(kz, kx)

    // 2. 计算风的绝对方向
    const windLength = Math.sqrt(params.windDirection.x ** 2 + params.windDirection.y ** 2)
    const theta_wind = Math.atan2(
      params.windDirection.y / windLength,
      params.windDirection.x / windLength
    )

    // 3. 计算相对角度（波与风的夹角）
    let theta = theta_wave - theta_wind

    // 4. 归一化到 [-π, π]
    while (theta > Math.PI) theta -= 2 * Math.PI
    while (theta < -Math.PI) theta += 2 * Math.PI

    // 5. 计算方向扩散指数 s
    const xi = params.swellMixing ?? 0 // 默认纯风浪
    const s = this.calculateDirectionalSpreading(omega, omegaPeak, xi)

    // 6. 计算归一化系数
    const normFactor = this.normalizationFactor(s)

    // 7. [公式] D_ξ(θ, ω) = C(s) * |cos(θ/2)|^(2s)
    const D = normFactor * Math.pow(Math.abs(Math.cos(theta / 2)), 2 * s)

    return D
  }

  /**
   * 方向分布函数 D(θ, ω) <= [简化版]
   * 使用 Mitsuyasu-Hasselmann 方向扩散模型
   *
   * @param kx 波向量x分量
   * @param kz 波向量z分量
   * @param params 海洋参数
   * @param omega 角频率
   * @param omegaPeak 峰值角频率
   * @returns 方向分布因子 D(θ,ω)
   */
  private directionMitsuyasuFactor(
    kx: number,
    kz: number,
    params: OceanParams,
    omega: number,
    omegaPeak: number
  ): number {
    const k = Math.sqrt(kx * kx + kz * kz)
    if (k < 0.000001) return 0

    // 计算单位波向量
    const kNorm = { x: kx / k, y: kz / k }

    // 归一化风向
    const windLength = Math.sqrt(
      params.windDirection.x * params.windDirection.x +
        params.windDirection.y * params.windDirection.y
    )
    const windNorm = {
      x: params.windDirection.x / windLength,
      y: params.windDirection.y / windLength
    }

    // 计算波向量与风向夹角 θ
    const kDotWind = kNorm.x * windNorm.x + kNorm.y * windNorm.y
    const theta = Math.acos(Math.min(Math.max(kDotWind, -1), 1))

    // 频率相关的方向性指数: s = 11.5 * (ω/ωp)^(-2.5)
    // - 低频(ω < ωp): s大 → 方向性弱 → 波浪各向扩散
    // - 高频(ω > ωp): s小 → 方向性强 → 波浪集中在风向
    const s = 11.5 * Math.pow(omega / omegaPeak, -2.5)

    // Mitsuyasu方向分布: D(θ,ω) = (2/π) * cos^(2s)(θ/2)
    const D = (2 / Math.PI) * Math.pow(Math.cos(theta / 2), 2 * s)

    return D
  }

  // ========== 短波过滤 (Short Wave Filter) ==========
  /**
   * [公式17] 短波衰减因子 swave(k, f) = exp(-(f * |k|)^2)
   * [公式18] 衰减系数 f（默认 0.01）
   *
   * @param k
   * @returns 短波衰减因子 swave
   */
  private shortWaveFilter(k: number): number {
    const f = 0.01 // [公式18]
    return Math.exp(-Math.pow(f * Math.abs(k), 2)) // [公式17]
  }

  // ========== 频率导数 (Frequency Derivative) ==========
  /**
   * F = g × { d|k|/cosh²(d|k|) + tanh[min(20,d|k|)] }
   *
   * @param kx 波向量x分量
   * @param kz 波向量z分量
   * @param params 海洋参数
   * @returns 频率导数 F
   */
  private calculateF(kx: number, kz: number, params: OceanParams): number {
    const k = Math.sqrt(kx * kx + kz * kz)
    if (k < 0.000001) return 0

    const d = Math.max(1e-12, params.depth ?? 1.0)
    const kd = k * d
    const cosh_kd = Math.cosh(kd)
    // sech_kd = 1 / cosh_kd, sech^2(kd) = 1 / (cosh_kd * cosh_kd)
    const sech2_kd = 1 / (cosh_kd * cosh_kd)

    const tanh_clamped = Math.tanh(Math.min(20, kd))

    const F = params.gravity * (kd * sech2_kd + tanh_clamped)

    return F
  }

  // ========== 二维方向谱 ==========
  /**
   * spec = J × Dξ(ω,θ) × swave
   * J: 一维频谱（已水深修正）
   * 𝐷𝜉(𝜔,𝜃): 方向分布，给不同方向分配能量
   * swave: 离散化时的随机化因子（相当于把连续谱转成离散波）
   *
   * @param kx 波向量x分量
   * @param kz 波向量z分量
   * @param params 海洋参数
   * @returns spec 二维方向谱
   */
  calculateSpec(kx: number, kz: number, params: OceanParams): number {
    const k = Math.sqrt(kx * kx + kz * kz)
    if (k < 0.000001) return 0

    // 深水色散关系: ω = √(gk)
    const omega = Math.sqrt(params.gravity * k)
    // ✅ 使用修正后的峰值频率计算
    const omegaPeak = this.calculatePeakFrequency(params)

    // const S_omega = this.calculateSOmega(kx, kz, params)

    // STMA: 一维频谱（已水深修正）
    const STMA = this.calculateSOmegaTMACorrection(kx, kz, params)

    // 𝐷𝜉(𝜔,𝜃): 方向分布，给不同方向分配能量
    // const Dxi = this.directionHasselmannFactor(kx, kz, params, omega, omegaPeak)
    const Dxi = this.directionMitsuyasuFactor(kx, kz, params, omega, omegaPeak)

    // swave: 离散化时的随机化因子（相当于把连续谱转成离散波）
    const swave = this.shortWaveFilter(k)

    const spec = STMA * Dxi * swave

    // console.log('STMA', STMA, 'spec_no_dir', spec)

    return spec
  }

  // ========== h0 magnitude ==========
  /**
   * [公式11] 计算初始振幅 h₀(k) 的模
   *
   * 关键转换公式:
   * 1. 能量守恒: ⟨η²⟩ = ∫S(ω)dω = ∫P(k)dk
   * 2. 因此: S(ω)dω = P(k)dk → P(k) = S(ω) * |dω/dk|
   * 3. 深水色散: ω² = gk → dω/dk = g/(2ω) = g/(2√(gk)) = √(g/k)/2
   * 4. 离散化: h₀(k) = Noise * √(P(k) * Δk²/2)
   *
   * Unity公式对比:
   * h0_magnitude = √(2 * (spec * |F| / |k|) * (4π² / L²))
   *              = √(2 * S(ω) * |dω/dk| / k * Δk²)
   *              = √(2 * P(k) / k * Δk²)  // 因为 P(k) = S(ω)|dω/dk|
   *
   * @param kx 波向量x分量
   * @param kz 波向量z分量
   * @param params 海洋参数
   * @param deltaK 波数间隔 Δk = 2π/L
   * @returns |h₀(k)|
   */
  calculateH0Magnitude(kx: number, kz: number, params: OceanParams): number {
    // 1. 计算 k 值
    const k = Math.sqrt(kx * kx + kz * kz)
    if (k < 0.000001) return 0

    // 2. 计算二维方向谱 spec
    const spec = this.calculateSpec(kx, kz, params)

    // 3. 计算频率导数 F
    const F = this.calculateF(kx, kz, params)

    // 4. 计算 h0_magnitude
    // |h0_magnitude|² = 2 * (spec * |F| / |k|) * (4π² / L²)
    const L = params.size
    const amplitudeSquared = 2 * ((spec * Math.abs(F)) / k) * ((4 * Math.PI * Math.PI) / (L * L))
    const h0_magnitude = Math.sqrt(Math.max(0, amplitudeSquared))

    return h0_magnitude
  }

  calculateH0MagnitudeSimplified(
    kx: number,
    kz: number,
    params: OceanParams,
    deltaK: number
  ): number {
    // 1. 计算 k 值
    const k = Math.sqrt(kx * kx + kz * kz)
    if (k < 0.000001) return 0

    // 1. 计算频率 ω = √(gk)
    const omega = Math.sqrt(params.gravity * k)

    // 3. 计算频率导数 dω/dk
    // 深水近似: dω/dk = g/(2ω) = g/(2√(gk)) = (1/2)√(g/k)
    const domegaDk = params.gravity / (2 * omega)

    // 2. 计算二维方向谱 spec
    const spec = this.calculateSpec(kx, kz, params)

    // 4. 计算 h0_magnitude
    // |h0_magnitude|² = (spec / |k|) * (dω / dk) * (Δkx * Δkz)
    const amplitudeSquared = (spec / k) * domegaDk * deltaK * deltaK
    const h0_magnitude = Math.sqrt(Math.max(0, amplitudeSquared))

    return h0_magnitude
  }
}

// export class JONSWAPSpectrum {
//   // ========== 基础参数 ==========
//   private gamma = 3.3 // 峰值增强因子 γ [公式3]
//   private sigma_a = 0.07 // 低频端宽度参数 σ [公式6]
//   private sigma_b = 0.09 // 高频端宽度参数 σ [公式6]

//   // ========== 非方向性频率函数(Non-directional Frequency Spectrum) ==========
//   /**
//    * 计算 Phillips 常数 α（修正版）
//    * α = 0.076 * (U₁₀²/Fg)^(0.22)  ← 注意是正指数！
//    *
//    * @param windSpeed U₁₀ - 10 米高度风速 (m/s)
//    * @param fetch F - 风区距离 (m)
//    * @param gravity g - 重力加速度 (m/s²)
//    * @returns Phillips常数 α
//    */
//   private calculateAlpha(windSpeed: number, fetch: number, gravity: number): number {
//     // U₁₀²/Fg 是无量纲参数
//     const dimensionlessParam = (windSpeed * windSpeed) / (fetch * gravity)

//     // ✅ 修正：指数改为 +0.22（不是 -0.22）
//     // fetch越大 → dimensionlessParam越小 → α越小（能量集中在低频）
//     return 0.076 * Math.pow(dimensionlessParam, 0.22)
//   }

//   /**
//    * 计算峰值角频率 ωp
//    * ωp = 22 * (g²/(U₁₀F))^(1/3)  ← 注意1/3次方！
//    *
//    * 注意: 这个公式考虑了fetch的影响
//    * - fetch小(受限风区) → ωp大 → 波长短
//    * - fetch大(开阔海域) → ωp小 → 波长长
//    *
//    * @param params 海洋参数
//    * @returns 峰值角频率 ωp (rad/s)
//    */
//   private calculatePeakFrequency(params: OceanParams): number {
//     // 如果没有fetch参数,使用简化公式: ωp = 0.877g/U
//     const fetch = params.fetch || ((params.windSpeed * params.windSpeed) / params.gravity) * 1000

//     // 完整公式: ωp = 22 * (g² / (U₁₀ * F))^(1/3)
//     const dimensionlessPeak = (params.gravity * params.gravity) / (params.windSpeed * fetch)
//     return 22 * Math.pow(dimensionlessPeak, 1 / 3)
//   }

//   /**
//    * 计算峰值增强因子 γ^r
//    * r = exp(-(ω-ωp)² / (2σ²ωp²))
//    *
//    * 这是一个高斯型峰值增强,使JONSWAP谱在峰值频率附近更尖锐
//    *
//    * @param omega 当前角频率 ω
//    * @param omegaPeak 峰值角频率 ωp
//    * @param gammaParam gamma参数 γ
//    * @returns γ^r
//    */
//   private calculateGammaFactor(omega: number, omegaPeak: number, gammaParam: number): number {
//     /**
//      * [公式6] 根据频率选择σ值
//      * σ = 0.07, if ω ≤ ωp
//      * σ = 0.09, if ω > ωp
//      */
//     const sigma = omega <= omegaPeak ? this.sigma_a : this.sigma_b

//     // [公式2] 计算指数 r
//     // r = exp(-(ω-ωp)² / (2σ²ωp²))
//     const r = Math.exp(
//       -Math.pow(omega - omegaPeak, 2) / (2 * sigma * sigma * omegaPeak * omegaPeak)
//     )

//     // 返回 γ^r
//     // 当 ω = ωp 时, r = 1, γ^r = γ = 3.3 (最大增强)
//     // 当 ω 远离 ωp 时, r → 0, γ^r → 1 (无增强)
//     return Math.pow(gammaParam, r)
//   }

//   /**
//    * 计算JONSWAP波谱 S(ω)
//    * S(ω) = (αg²/ω⁵) * exp(-5/4*(ωp/ω)⁴) * γ^r
//    *
//    * @param kx 波向量x分量
//    * @param kz 波向量z分量
//    * @param params 海洋参数
//    * @returns S(ω) 频谱密度 (m²·s)
//    */
//   calculateSOmega(kx: number, kz: number, params: OceanParams): number {
//     const k = Math.sqrt(kx * kx + kz * kz)
//     if (k < 0.000001) return 0

//     // 深水色散关系: ω = √(gk)
//     const omega = Math.sqrt(params.gravity * k)
//     // ✅ 使用修正后的峰值频率计算
//     const omegaPeak = this.calculatePeakFrequency(params)

//     // ✅ 使用修正后的alpha计算
//     // 计算α (如果没有fetch,退化为Phillips常数)
//     const fetch = params.fetch || ((params.windSpeed * params.windSpeed) / params.gravity) * 1000
//     const alpha = this.calculateAlpha(params.windSpeed, fetch, params.gravity)

//     // [公式1] JONSWAP谱基础项
//     // Phillips谱形式: (αg²)/ω⁵
//     const phillipsBase = (alpha * Math.pow(params.gravity, 2)) / Math.pow(omega, 5)

//     // 指数衰减项: exp(-5/4 * (ωp/ω)⁴)
//     // 注意: 这里是-5/4,不是-1.25!
//     // -5/4 = -1.25,但要确保使用正确的系数
//     const exponential = Math.exp(-1.25 * Math.pow(omegaPeak / omega, 4))

//     // [公式2] 峰值增强因子 γ^r
//     const gammaFactor = this.calculateGammaFactor(omega, omegaPeak, this.gamma)

//     // 组合得到非方向性频谱 S(ω)
//     const S_omega = phillipsBase * exponential * gammaFactor

//     return S_omega
//   }

//   // ========== 频率依赖函数 (Frequency-dependent Function) ==========
//   /**
//    * 深水频率依赖函数 Φ(ωh)
//    * 用于修正深水/浅水效应
//    *
//    * @param omega 角频率 ω
//    * @param depth 水深 d
//    * @param gravity 重力加速度 g
//    * @returns Φ(ωh) 修正因子
//    */
//   private calculateDepthFactor(omega: number, depth: number, gravity: number): number {
//     // ωh = ω * sqrt(d/g) 是无量纲频率参数
//     const omega_h = omega * Math.sqrt(depth / gravity)

//     let phi: number = 0
//     // [公式7]
//     // if (omega_h <= 1) {
//     //   // 浅水区域: Φ = 0.5 * ωh²
//     //   phi = 0.5 * omega_h * omega_h
//     // } else {
//     //   // 深水区域: Φ = 1 - 0.5 * (2 - ωh)²
//     //   phi = 1 - 0.5 * (2 - omega_h) * (2 - omega_h)
//     // }

//     if (omega_h <= 1) {
//       phi = 0.5 * omega_h * omega_h
//     } else if (omega_h < 2) {
//       phi = 1 - 0.5 * Math.pow(2 - omega_h, 2)
//     } else {
//       phi = 1.0 // ✅ 深水不衰减
//     }

//     // // clamp 到 [0,1]
//     // if (phi < 0) return 0
//     // if (phi > 1) return 1

//     return phi
//   }

//   /**
//    * JONSWAP 深水频谱的 TMA 矫正 J = S(ω) · Φ(ωh)
//    * 这里把 S(ω)（非方向性）和 Φ 相乘，返回 J（只是频率方向无向的能量项）
//    *
//    * @param omega 角频率 ω
//    * @param depth 水深 d
//    * @param gravity 重力加速度 g
//    * @returns J = S(ω) · Φ(ωh)
//    */
//   private calculateSOmegaTMACorrection(kx: number, kz: number, params: OceanParams): number {
//     const k = Math.sqrt(kx * kx + kz * kz)
//     if (k < 0.000001) return 0

//     // 深水色散关系: ω = √(gk)
//     const omega = Math.sqrt(params.gravity * k)

//     // S(ω) = (α g^2 / ω^5) * exp(-5/4 (ωp/ω)^4) * γ^r
//     const S_omega = this.calculateSOmega(kx, kz, params) // 非方向性谱 S(ω)
//     // console.log(S_omega)

//     // Φ(ωh) 修正
//     const phi =
//       params.depth && params.depth > 0 && params.depth < 50
//         ? this.calculateDepthFactor(omega, params.depth, params.gravity)
//         : 1.0

//     // console.log(phi)

//     const J = S_omega * phi // [公式8]
//     return J
//   }

//   // ========== 方向扩展 (Directional Spreading) ==========
//   /**
//    * [Hasselmann 1980] 计算方向扩散指数 s
//    *
//    * @param omega 当前角频率
//    * @param omegaPeak 峰值角频率
//    * @param xi 风浪-涌浪混合参数（默认0）
//    * @returns 方向扩散指数 s
//    */
//   private calculateDirectionalSpreading(omega: number, omegaPeak: number, xi: number = 0): number {
//     // s_p: 主要频率依赖项（分段函数）
//     let sp: number = 0
//     if (omega <= omegaPeak) {
//       // 低频段: s_p = 9.77 * (ω/ωₚ)^(-2.5)
//       sp = 9.77 * Math.pow(omega / omegaPeak, -2.5)
//     } else {
//       // 高频段: s_p = 6.97 * (ω/ωₚ)^5
//       sp = 6.97 * Math.pow(omega / omegaPeak, 5)
//     }

//     // s_ξ: 风浪-涌浪混合项
//     // s_ξ = 16*tanh(ωₚ/ω) + ξ²
//     const s_xi = 16 * Math.tanh(omegaPeak / omega) + xi * xi

//     // 总扩散指数
//     const s = sp + s_xi

//     return s
//   }

//   /**
//    * [公式] 归一化系数 C(s)
//    * 确保 ∫D(θ)dθ = 1
//    *
//    * 对于 D(θ) = C(s) * |cos(θ/2)|^(2s)
//    * 积分得: C(s) = Γ(s+1) / [√π * Γ(s+1/2)]
//    *
//    * 使用数值逼近或查找表
//    */
//   private normalizationFactor(s: number): number {
//     // 方法1: 使用 Gamma 函数（需要引入数学库）
//     // return gamma(s + 1) / (Math.sqrt(Math.PI) * gamma(s + 0.5))

//     // 方法2: 数值积分（更稳健）
//     const N_SAMPLES = 100
//     let integral = 0
//     for (let i = 0; i < N_SAMPLES; i++) {
//       const theta = -Math.PI + (2 * Math.PI * i) / N_SAMPLES
//       integral += Math.pow(Math.abs(Math.cos(theta / 2)), 2 * s)
//     }
//     integral *= (2 * Math.PI) / N_SAMPLES

//     return 1 / integral

//     // 方法3: 经验公式近似（最快）
//     // 对于 s ∈ [1, 100]，误差 < 2%
//     // return (2 / Math.PI) * Math.pow(2, s) * Math.exp(lgamma(s + 1) - lgamma(s + 0.5) - 0.5*Math.log(Math.PI))
//   }

//   /**
//    * [完整版]  Hasselmann 方向分布函数 D_ξ(θ, ω)
//    *
//    * @param kx 波向量 x 分量
//    * @param kz 波向量 z 分量
//    * @param params 海洋参数
//    * @param omega 当前角频率
//    * @param omegaPeak 峰值角频率
//    * @returns 方向分布因子 D_ξ(θ, ω)
//    */
//   private directionHasselmannFactor(
//     kx: number,
//     kz: number,
//     params: OceanParams,
//     omega: number,
//     omegaPeak: number
//   ): number {
//     const k = Math.sqrt(kx * kx + kz * kz)
//     if (k < 0.000001) return 0

//     // 1.计算波的绝对传播方向
//     const theta_wave = Math.atan2(kz, kx)

//     // 2. 计算风的绝对方向
//     const windLength = Math.sqrt(params.windDirection.x ** 2 + params.windDirection.y ** 2)
//     const theta_wind = Math.atan2(
//       params.windDirection.y / windLength,
//       params.windDirection.x / windLength
//     )

//     // 3. 计算相对角度（波与风的夹角）
//     let theta = theta_wave - theta_wind

//     // 4. 归一化到 [-π, π]
//     while (theta > Math.PI) theta -= 2 * Math.PI
//     while (theta < -Math.PI) theta += 2 * Math.PI

//     // 5. 计算方向扩散指数 s
//     const xi = params.swellMixing ?? 0 // 默认纯风浪
//     const s = this.calculateDirectionalSpreading(omega, omegaPeak, xi)

//     // 6. 计算归一化系数
//     const normFactor = this.normalizationFactor(s)

//     // 7. [公式] D_ξ(θ, ω) = C(s) * |cos(θ/2)|^(2s)
//     const D = normFactor * Math.pow(Math.abs(Math.cos(theta / 2)), 2 * s)

//     return D
//   }

//   /**
//    * 方向分布函数 D(θ, ω) <= [简化版]
//    * 使用 Mitsuyasu-Hasselmann 方向扩散模型
//    *
//    * @param kx 波向量x分量
//    * @param kz 波向量z分量
//    * @param params 海洋参数
//    * @param omega 角频率
//    * @param omegaPeak 峰值角频率
//    * @returns 方向分布因子 D(θ,ω)
//    */
//   private directionMitsuyasuFactor(
//     kx: number,
//     kz: number,
//     params: OceanParams,
//     omega: number,
//     omegaPeak: number
//   ): number {
//     const k = Math.sqrt(kx * kx + kz * kz)
//     if (k < 0.000001) return 0

//     // 计算单位波向量
//     const kNorm = { x: kx / k, y: kz / k }

//     // 归一化风向
//     const windLength = Math.sqrt(
//       params.windDirection.x * params.windDirection.x +
//         params.windDirection.y * params.windDirection.y
//     )
//     const windNorm = {
//       x: params.windDirection.x / windLength,
//       y: params.windDirection.y / windLength
//     }

//     // 计算波向量与风向夹角 θ
//     const kDotWind = kNorm.x * windNorm.x + kNorm.y * windNorm.y
//     const theta = Math.acos(Math.min(Math.max(kDotWind, -1), 1))

//     // 频率相关的方向性指数: s = 11.5 * (ω/ωp)^(-2.5)
//     // - 低频(ω < ωp): s大 → 方向性弱 → 波浪各向扩散
//     // - 高频(ω > ωp): s小 → 方向性强 → 波浪集中在风向
//     const s = 11.5 * Math.pow(omega / omegaPeak, -2.5)

//     // Mitsuyasu方向分布: D(θ,ω) = (2/π) * cos^(2s)(θ/2)
//     const D = (2 / Math.PI) * Math.pow(Math.cos(theta / 2), 2 * s)

//     return D
//   }

//   // ========== 短波过滤 (Short Wave Filter) ==========
//   /**
//    * [公式17] 短波衰减因子 swave(k, f) = exp(-(f * |k|)^2)
//    * [公式18] 衰减系数 f（默认 0.01）
//    *
//    * @param k
//    * @returns 短波衰减因子 swave
//    */
//   private shortWaveFilter(k: number): number {
//     const f = 0.01 // [公式18]
//     return Math.exp(-Math.pow(f * Math.abs(k), 2)) // [公式17]
//   }

//   // ========== 频率导数 (Frequency Derivative) ==========
//   /**
//    * F = g × { d|k|/cosh²(d|k|) + tanh[min(20,d|k|)] }
//    *
//    * @param kx 波向量x分量
//    * @param kz 波向量z分量
//    * @param params 海洋参数
//    * @returns 频率导数 F
//    */
//   private calculateF(kx: number, kz: number, params: OceanParams): number {
//     const k = Math.sqrt(kx * kx + kz * kz)
//     if (k < 0.000001) return 0

//     const d = Math.max(1e-12, params.depth ?? 1.0)
//     const kd = k * d
//     const cosh_kd = Math.cosh(kd)
//     // sech_kd = 1 / cosh_kd, sech^2(kd) = 1 / (cosh_kd * cosh_kd)
//     const sech2_kd = 1 / (cosh_kd * cosh_kd)

//     const tanh_clamped = Math.tanh(Math.min(20, kd))

//     const F = params.gravity * (kd * sech2_kd + tanh_clamped)

//     return F
//   }

//   // ========== 能量指标(Energy index) ==========
//   /**
//    * [公式19] 计算波高方差（能量指标）
//    * ⟨ζ²⟩ = 1.67×10⁻⁷ * (U₁₀²/g) * F
//    *
//    * @param windSpeed U₁₀ - 风速 (m/s)
//    * @param fetch F - fetch (m)
//    * @param gravity g - 重力加速度 (m/s²)
//    * @returns 波高方差 (m²)
//    */
//   private calculateWaveEnergy(windSpeed: number, fetch: number, gravity: number): number {
//     // ⟨ζ²⟩ = 1.67×10⁻⁷ * (U₁₀²/g) * F
//     const energyCoeff = 1.67e-7
//     const waveVariance = energyCoeff * ((windSpeed * windSpeed) / gravity) * fetch

//     // 有效波高 H_s ≈ 4 * √⟨ζ²⟩
//     const significantWaveHeight = 4 * Math.sqrt(waveVariance)

//     console.log(`波高方差: ${waveVariance.toFixed(4)} m²`)
//     console.log(`有效波高: ${significantWaveHeight.toFixed(2)} m`)

//     return waveVariance
//   }

//   // ========== 二维方向谱 ==========
//   /**
//    * spec = J × Dξ(ω,θ) × swave
//    * J: 一维频谱（已水深修正）
//    * 𝐷𝜉(𝜔,𝜃): 方向分布，给不同方向分配能量
//    * swave: 离散化时的随机化因子（相当于把连续谱转成离散波）
//    *
//    * @param kx 波向量x分量
//    * @param kz 波向量z分量
//    * @param params 海洋参数
//    * @returns spec 二维方向谱
//    */
//   calculateSpec(kx: number, kz: number, params: OceanParams): number {
//     const k = Math.sqrt(kx * kx + kz * kz)
//     if (k < 0.000001) return 0

//     // 深水色散关系: ω = √(gk)
//     const omega = Math.sqrt(params.gravity * k)
//     // ✅ 使用修正后的峰值频率计算
//     const omegaPeak = this.calculatePeakFrequency(params)

//     // const S_omega = this.calculateSOmega(kx, kz, params)

//     // J: 一维频谱（已水深修正）
//     const STMA = this.calculateSOmegaTMACorrection(kx, kz, params)

//     // 𝐷𝜉(𝜔,𝜃): 方向分布，给不同方向分配能量
//     const Dxi = this.directionHasselmannFactor(kx, kz, params, omega, omegaPeak)

//     // swave: 离散化时的随机化因子（相当于把连续谱转成离散波）
//     const swave = this.shortWaveFilter(k)

//     const spec = STMA * Dxi * swave

//     // console.log(J)

//     return spec
//   }

//   // ========== h0 magnitude ==========
//   /**
//    * [公式11] 计算初始振幅 h₀(k) 的模
//    *
//    * 关键转换公式:
//    * 1. 能量守恒: ⟨η²⟩ = ∫S(ω)dω = ∫P(k)dk
//    * 2. 因此: S(ω)dω = P(k)dk → P(k) = S(ω) * |dω/dk|
//    * 3. 深水色散: ω² = gk → dω/dk = g/(2ω) = g/(2√(gk)) = √(g/k)/2
//    * 4. 离散化: h₀(k) = Noise * √(P(k) * Δk²/2)
//    *
//    * Unity公式对比:
//    * h0_magnitude = √(2 * (spec * |F| / |k|) * (4π² / L²))
//    *              = √(2 * S(ω) * |dω/dk| / k * Δk²)
//    *              = √(2 * P(k) / k * Δk²)  // 因为 P(k) = S(ω)|dω/dk|
//    *
//    * @param kx 波向量x分量
//    * @param kz 波向量z分量
//    * @param params 海洋参数
//    * @param deltaK 波数间隔 Δk = 2π/L
//    * @returns |h₀(k)|
//    */
//   calculateH0Magnitude(kx: number, kz: number, params: OceanParams, deltaK: number): number {
//     // 1. 计算 k 值
//     const k = Math.sqrt(kx * kx + kz * kz)
//     if (k < 0.000001) return 0

//     // 1. 计算频率 ω = √(gk)
//     const omega = Math.sqrt(params.gravity * k)

//     // 2. 计算二维方向谱 spec
//     const spec = this.calculateSpec(kx, kz, params)

//     // 3. 计算频率导数 F
//     const F = this.calculateF(kx, kz, params)

//     // 4. 计算 h0_magnitude
//     // |h0_magnitude|² = 2 * (spec * |F| / |k|) * (4π² / L²)
//     const L = params.size
//     const amplitudeSquared = 2 * ((spec * Math.abs(F)) / k) * ((4 * Math.PI * Math.PI) / (L * L))
//     const h0_magnitude = Math.sqrt(Math.max(0, amplitudeSquared))

//     // 2. 计算 S(ω)
//     // const S_omega = this.calculateSOmega(kx,kz,params)

//     // 3. 计算频率导数 dω/dk
//     // 深水近似: dω/dk = g/(2ω) = g/(2√(gk)) = (1/2)√(g/k)
//     // const domegaDk = params.gravity / (2 * omega)

//     // 如果有深度参数,使用完整色散关系 [公式10]
//     // ω² = gk·tanh(kd) → dω/dk = (g/2ω)[d·k/cosh²(kd) + tanh(min(20,kd))]
//     // 但这里为简化,仍用深水近似

//     // 4. 转换到波数谱 P(k) = S(ω) * |dω/dk|
//     // const P_k = S_omega * Math.abs(domegaDk)

//     // 5. [公式11变形] 离散化振幅
//     // 理论: h₀ = Noise * √(P(k)/2) * Δk
//     // Unity: h₀ = Noise * √(2*P(k)/k * Δk²)
//     // const h0_magnitude = Math.sqrt(P_k / 2.0) * deltaK

//     // 或者使用Unity公式 (更常见):
//     // const h0_magnitude = Math.sqrt((2 * P_k / k) * deltaK * deltaK)

//     return h0_magnitude
//   }
// }
