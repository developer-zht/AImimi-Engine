import { ShadowConfig, ShadowRenderDefaults } from '../types/shadow'

/**
 *  默认的 {@link ShadowConfig } 配置
 */
export const DEFAULT_SHADOW_CONFIG: ShadowConfig = {
  orthoSize: 100,
  near: 0.01,
  far: 1000
}

/**
 *  默认的 {@link ShadowRenderDefaults } 配置
 */
export const DEFAULT_SHADOW_RENDER: ShadowRenderDefaults = {
  method: 0,
  filterRadius: 10
}
