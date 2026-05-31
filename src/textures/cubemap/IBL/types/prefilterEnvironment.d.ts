export interface PrefilterEnvironmentOptions {
  baseResolution?: number // mip 0 边长，默认 256
  numMips?: number // 默认 5 → roughness ∈ {0, 0.25, 0.5, 0.75, 1.0}
  sampleCount?: number // GGX 重要性采样次数，默认 1024
  fireflyClamp?: number // HDR 单像素亮度上限；-1 = 禁用；推荐 20（晴天）/40（弱光场景）
}
