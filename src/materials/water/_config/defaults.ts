import { WaterMaterialConfig } from '../types/WaterMaterialConfig'
import { FFTOceanMaterialConfig } from '../types/FFTOceanMaterialConfig'
import { SineWaveMaterialConfig } from '../types/SineWaveMaterialConfig'
import { GerstnerWaveMaterialConfig } from '../types/GerstnerWaveMaterialConfig'

/** 所有水体材质共享的默认值 */
export const WATER_MATERIAL_DEFAULTS: Required<WaterMaterialConfig> = {
  // ── 1. 纹理开关与贴图 ──
  useDiffuseMap: 0,
  diffuseMap: null,
  useNormalMap: 0,
  normalMap: null,
  useEnvironmentMap: 0,
  environmentMap: null,

  // ── 2. 水体颜色 ──
  ambientColor: [0.35, 0.5, 0.65],
  // waterColor: [0.1, 0.3, 0.5],
  // deepWaterColor: [0.0, 0.1, 0.2],
  // shallowWaterColor: [0.2, 0.6, 0.8],

  // ── 3. 水体物理 ──
  transparency: 0.8,
  reflectance: 0.3,
  refractiveIndex: 1.33,

  // ── 4. 水深模型 ──
  depthModel: 2,
  maxDepth: 50.0,
  minDepth: 1.0,
  depthCenter: [0, 0],
  depthFalloff: 1.5,

  // ── 5. 光照 ──
  specularPower: 32.0,
  fresnelPower: 5.0,

  // ── 6. Cook-Torrance(exclusive) ──
  roughness: 0.15,

  // ── 7. SSS ──
  wavePeakScatterStrength: 1.0,
  scatterStrength: 1.0,
  scatterShadowStrength: 0.5,
  ambientDensity: 0.3,
  scatterColor: [0.016, 0.073, 0.165], // 深青蓝（体散射常见色）
  scatterPeakColor: [0.4, 0.85, 0.9], // 亮青（波峰透光）

  // ── 8. 环境反射 ──
  envirLightStrength: 1.0,

  // ── 9. 阴影 ──
  shadowIntensity: 0.2, // 作者 0.2

  // ── 10. Foam ──
  foamColor: [1.0, 1.0, 1.0],
  foamRoughness: 0.2,
  foamBias: 0.2,
  foamPower: 1.5,
  foamAdd: 0.1,
  foamDecayRate: 0.05,

  // ---- 11. 近/远法线过渡 ----
  varMaskRange: 3.0,
  varMaskPower: 3.0,
  varMaskTexScale: 2.0,

  // ── 12. 远近距离衰减（相机距离，与几何方法无关）──
  displaceDepthAttenuation: 10.0,
  foamDepthAttenuation: 20.0,

  // ── 13. 表面缩放（任何有 normal/height 的水都能用）──
  normalStrength: 0.2,
  heightStrength: 1.0
}

/** FFT Ocean 默认值 */
export const FFT_OCEAN_MATERIAL_DEFAULTS: Required<FFTOceanMaterialConfig> = {
  ...WATER_MATERIAL_DEFAULTS,

  displacementMap: null,
  gradientMap: null,
  dispDerivativeMap: null
}

/** Sine Wave 默认值 */
export const SINE_WAVE_MATERIAL_DEFAULTS: Required<SineWaveMaterialConfig> = {
  ...WATER_MATERIAL_DEFAULTS,
  amplitude: 1.0,
  waveVector: [1.0, 0.0],
  angularFrequency: 1.0
}

/** Gerstner Wave 默认值 */
export const GERSTNER_WAVE_MATERIAL_DEFAULTS: Required<GerstnerWaveMaterialConfig> = {
  ...WATER_MATERIAL_DEFAULTS,
  waveCount: 4,
  waves: [] // 由场景配置注入
}
