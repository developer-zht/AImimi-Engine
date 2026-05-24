import { mat4 } from 'gl-matrix'

// ============================================================
//  阴影能力（独立接口）
// ============================================================

/** 能投射阴影的光源（方向光、聚光灯等） */
export interface IShadowCaster {
  castShadow: boolean // 是否投射阴影，默认 false
  shadowResolution: number // 阴影分辨率，默认 1024
  worldSize: number // 世界坐标系下的光源物理大小，PCSS 用
}

/**
 * 方向光 / 聚光灯的阴影
 * 单个 VP 矩阵，渲染到一张 2D shadow map
 */
export interface IDirectionalShadow extends IShadowCaster {
  /** 灯光视角的 View × Projection 矩阵 */
  getViewProjectionMatrix(): mat4
}

/**
 * TODO（预留）:
 * 点光源的阴影
 * 6 个 VP 矩阵，渲染到 cube shadow map
 */
export interface IPointShadow extends IShadowCaster {
  getCubeViewProjectionMatrices(): mat4[]
}

// ============================================================
//  阴影配置
// ============================================================

/** 光源视角配置 */
export interface ShadowConfig {
  /** 正交投影的半宽度（实际范围 = [-size, size]） */
  orthoSize: number
  /** 近裁剪面 */
  near: number
  /** 远裁剪面 */
  far: number
}

/** 阴影渲染偏好（用户可调参数的默认值） */
export interface ShadowRenderDefaults {
  /** 0=Hard, 1=PCF, 2=PCSS */
  method: number
  /** PCF 采样半径 (texel) */
  filterRadius: number
}
