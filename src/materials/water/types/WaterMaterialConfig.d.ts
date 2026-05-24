/** 水体材质共享配置 */
export interface WaterMaterialConfig {
  // ── 1. 纹理开关与贴图 ──
  useDiffuseMap?: number // 0 | 1
  useNormalMap?: number
  useEnvironmentMap?: number
  diffuseMap?: WebGLTexture | null
  normalMap?: WebGLTexture | null
  environmentMap?: WebGLTexture | null

  // ── 2. 水体颜色（水体本身没有颜色，用 ambientColor 兜底）──
  ambientColor?: [number, number, number] // 替代 SH9 的环境漫反射色
  // waterColor?: [number, number, number]
  // deepWaterColor?: [number, number, number]
  // shallowWaterColor?: [number, number, number]

  // ── 3. 水体物理（折射 / 透明） ──
  transparency?: number
  reflectance?: number
  refractiveIndex?: number

  // ── 4. 水深模型（程序化深度，独立于波浪生成）──
  depthModel?: number // 0=uniform, 1=linear, 2=radial, 3=noise
  maxDepth?: number
  minDepth?: number
  depthCenter?: [number, number]
  depthFalloff?: number

  // ── 5. Blinn-Phong 光照模型 ──
  specularPower?: number
  fresnelPower?: number

  // ── 6. Cook-Torrance 核心 (exclusive) ──
  roughness?: number // m，微表面 RMS 斜率（0.05~0.3 合理）

  // ── 7. SSS（任何有 N/V/L/H 的水都能用）──
  wavePeakScatterStrength?: number // σ_peak, k1
  scatterStrength?: number // σ_view, k2
  scatterShadowStrength?: number // σ_sh, k3
  ambientDensity?: number // ρ_amb, k4
  scatterColor?: [number, number, number] // C_scatter（k2/k3）
  scatterPeakColor?: [number, number, number] // C_peak（k1）

  // ── 8. 环境反射 ──
  envirLightStrength?: number // cubemap 亮度增益

  // ---- 9. 阴影 ----
  shadowIntensity?: number // 阴影软化 lift

  // ---- 10. Foam（任何有 chop / Jacobian 概念的水都能用） ----
  foamUVScale?: number
  foamColor?: [number, number, number]
  foamRoughness?: number
  foamBias?: number
  foamPower?: number
  foamAdd?: number
  foamDecayRate?: number

  // ── 11. 远近距离衰减（相机距离，与几何方法无关）──
  displaceDepthAttenuation?: number
  foamDepthAttenuation?: number

  // ---- 12. 近/远法线过渡 ----
  varMaskRange?: number
  varMaskPower?: number
  varMaskTexScale?: number

  // ── 13. 表面缩放（任何有 normal/height 的水都能用）──
  normalStrength?: number // 法线缩放，默认 0.2
  heightStrength?: number // 波高缩放，默认 1.0
}
