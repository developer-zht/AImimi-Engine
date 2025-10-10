// =============== WaterRenderManager ===============
// 水体渲染器类型枚举
export enum WaterRenderType {
  SINE_WAVE = 'sine_wave',
  GERSTNER_WAVE = 'gerstner_wave', // 预留给未来的 Gerstner Wave 实现
  FFT_WAVE = 'fft_wave' // 预留给未来的 FFT 实现
}

// 水体渲染配置接口
export interface WaterRenderManagerConfig {
  // 几何参数
  size: number
  resolution: number
  tranformation: TransformationParams

  // 渲染类型
  renderType: WaterRenderType

  // 材质参数
  materialParams: SineWaveMaterialParams | GerstnerWaveMaterialParams

  // 渲染选项
  enableReflection?: boolean
  enableRefraction?: boolean
  enableFoam?: boolean
  enableCaustics?: boolean
  // 是否开启 shadow map 和 SSR
  enableShadowMap?: boolean // 启用阴影贴图
  enableSSR?: boolean // 启用屏幕空间反射
}

// =============== WaterPresets ===============
// 水体类型
export enum WaterType {
  TROPICAL_OCEAN = 'tropicalOcean', // 热带海洋
  DEEP_OCEAN = 'deepOcean', // 深海
  LAKE = 'lake', // 湖泊
  RIVER_MURKY = 'murkyRiver' // 河流（浑浊）
}

// 波浪类型
export enum WavesType {
  OCEAN_WAVES = 'oceanWave', // 海洋级别的波浪
  LAKE_WAVES = 'lakeWaves' // 湖泊级别的波浪
}
