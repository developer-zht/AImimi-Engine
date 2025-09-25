import { FFTOceanMaterialParams } from '@/materials/FFTOceanMaterial'
import { TransformationParams } from '@/types/transformation'

export interface FFTOceanRenderManagerConfig {
  // 几何参数
  tranformation: TransformationParams

  // 材质参数
  materialParams: FFTOceanMaterialParams

  // FFT Ocean
  // oceanParams?: OceanParams
  cascadeConfig: CascadeConfig
}

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
  depth?: number // 水深（用于有限深度）
  fetch?: number // 风区大小
  swellMixing?: number // ξ 参数，默认0（纯风浪）
  amplitude?: number // 能量缩放系数
  // cascadeConfig?: CascadeConfig // 可选的 cascade 配置
}

// Cascade Layer 配置
export interface CascadeLayerParams {
  size: number // 海面片元尺寸（米）
  resolution: number // 网格分辨率（必须是2的幂）
  windSpeed: number // 风速 (m/s)
  windDirection: WindDirection // 风向（归一化）
  gravity: number // 重力加速度
  choppiness: number // 波浪尖锐度
  depth?: number // 水深（用于有限深度）
  fetch?: number // 风区大小
  swellMixing?: number // ξ 参数，默认0（纯风浪）
  amplitude?: number // 能量缩放系数
}

// Cascade 配置
export interface CascadeConfig {
  enabled: boolean // 是否启用 cascade，true 为 cascade，false 为 single
  targetResolution: number // 目标统一分辨率，默认使用最高层分辨率
  targetSize: number // 目标统一范围，默认使用最大范围
  blendMode: 'additive' | 'weighted' // 混合模式：相加或加权
  layerParamsSet: CascadeLayerParams[] // cascade 层级配置
}
