import { FFTOceanMaterialParams } from '@/materials/water/deprecated/FFTOceanMaterial-deprecated'
import { TransformationParams } from '@/objects/types/transformation'
import { Transform } from '@/objects/utils/Transform'

export interface FFTOceanRenderManagerConfig {
  // 几何参数
  transform: Transform

  // 材质参数
  materialParams: FFTOceanMaterialParams

  // FFT Ocean
  // oceanParams?: OceanParams // Deprecated
  cascadeConfig: CascadeConfig
}

interface WindDirection {
  x: number
  y: number
}

// Deprecated
// export interface OceanParams {
//   size: number // 海面片元尺寸（米）
//   resolution: number // 网格分辨率（必须是2的幂）
//   windSpeed: number // 风速 (m/s)
//   windDirection: WindDirection // 风向（归一化）
//   gravity: number // 重力加速度
//   choppiness: number // 波浪尖锐度
//   depth?: number // 水深（用于有限深度）
//   fetch?: number // 风区大小
//   swellMixing?: number // ξ 参数，默认0（纯风浪）
//   amplitude?: number // 能量缩放系数
//   // cascadeConfig?: CascadeConfig // 可选的 cascade 配置
// }

// Cascade 配置
export interface CascadeConfig {
  renderingMode: RenderingMode
  enabled: boolean // 是否启用 cascade，true 为 cascade，false 为 single
  meshResolution: number // 目标统一分辨率，默认使用最高层分辨率
  meshSize: number // 目标统一范围，默认使用最大范围
  blendMode: BlendMode // 混合模式：相加或加权
  layerParamsSet: CascadeLayerParams[] // cascade 层级配置
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

export enum BlendMode {
  ADDITIVE = 'additive',
  WEIGHTED = 'weighted'
}

export enum RenderingMode {
  LINE = 'line',
  MESH = 'mesh'
}
