/**
 * JONSWAP 单子谱参数
 *
 * 对应作者的 `[SerializeField] struct DisplaySpectrumSettings`：
 * - scale            能量缩放（未开平方前）
 * - windSpeed        风速 U₁₀ (m/s)
 * - windDirection    风向（度，0 = +x 方向）
 * - fetch            风区距离 (m)
 * - spreadBlend      方向各向异性混合：1 = 完全沿风向，0 = 各向同性
 * - swell            涌浪项 ξ（Hasselmann），0~1
 * - peakEnhancement  γ（JONSWAP 峰化因子，默认 3.3）
 * - shortWavesFade   短波截断尺度 (m)，控制高频衰减起始
 */
export interface SpectrumSettings {
  scale: number
  windSpeed: number
  windDirection: number // 角度，单位：度
  fetch: number
  spreadBlend: number
  swell: number
  peakEnhancement: number
  shortWavesFade: number
}
