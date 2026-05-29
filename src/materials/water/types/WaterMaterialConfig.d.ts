/** 水体材质共享配置 */
export interface WaterMaterialConfig {
  // ── 1. 纹理开关与贴图 ──
  useDiffuseMap?: number // 0 | 1（旧字段，保留以兼容 Sine/Gerstner 材质；FFT 多层 shader 已删 diffuse 通路）
  useNormalMap?: number //  0 | 1（同上）
  useEnvironmentMap?: number // 0 | 1（关闭 IBL specular，envReflect 归零）
  diffuseMap?: WebGLTexture | null
  normalMap?: WebGLTexture | null
  environmentMap?: WebGLTexture | null

  // ── 1.5 多层 FFT shader 独有的子通路开关 ──
  //   useFoam — 关闭 foam mask 计算 + 末尾混色；纯粹观察 PBR 本体的最快路径
  //   useFog  — 关闭大气透视 fog 混色；近场调试时常用（避免远景被雾染白）
  useFoam?: number // 0 | 1，默认 1
  useFog?: number // 0 | 1，默认 1

  // ── 2. 水体颜色（水体本身没有颜色，用 ambientColor 兜底）──
  ambientColor?: [number, number, number] // 替代 SH9 的环境漫反射色

  // ── 3. 水体物理（折射 / 透明） ──
  transparency?: number // 旧字段；多层 shader 当前直接 alpha = 1.0
  reflectance?: number // 旧字段；多层 shader 未消费
  refractiveIndex?: number // η（水≈1.33），决定 F0

  // ── 4. 水深模型（旧字段，多层 shader 未消费；保留供其它水体材质） ──
  depthModel?: number // 0=uniform, 1=linear, 2=radial, 3=noise
  maxDepth?: number
  minDepth?: number
  depthCenter?: [number, number]
  depthFalloff?: number

  // ── 5. Blinn-Phong 光照模型（旧字段，多层 shader 已切到 Cook-Torrance）──
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
  foamUVScale?: number // uv = worldXZ · scale；scale 越大颗粒越细，但 tile 重复越明显
  foamColor?: [number, number, number]
  foamRoughness?: number // foamMask=1 时叠加到 roughness 上
  foamBias?: number // 旧字段；多层 shader 直接读 compute pass 写好的 alpha
  foamPower?: number // 旧字段；同上
  foamAdd?: number // 旧字段；同上
  foamDecayRate?: number // 旧字段；同上

  // ---- 11. Fog ----
  fogColor?: [number, number, number]
  fogDensity?: number // 1/m
  fogPower?: number // 曲线弯曲度

  // ── 12. 远近距离衰减（相机距离，与几何方法无关）──
  displaceDepthAttenuation?: number
  foamDepthAttenuation?: number // 旧字段；多层 shader 未消费

  // ---- 13. 近/远法线过渡 ----
  varMaskRange?: number
  varMaskPower?: number
  varMaskTexScale?: number

  // ── 14. 表面缩放（任何有 normal/height 的水都能用）──
  normalStrength?: number // 法线缩放，默认 0.2
  heightStrength?: number // 波高缩放，默认 1.0
}
