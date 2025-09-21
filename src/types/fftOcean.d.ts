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
  amplitude?: number
}
