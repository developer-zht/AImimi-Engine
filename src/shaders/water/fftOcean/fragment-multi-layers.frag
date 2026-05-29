// prettier-ignore
#extension GL_EXT_shader_texture_lod : enable
// prettier-ignore
#extension GL_OES_standard_derivatives : enable

#ifdef GL_ES
precision highp float;
#endif

// ---- render pass 注入（不经过 Material，由 ForwardRenderPass 直接绑定）----
uniform mat3 uNormalMatrix;

// ---- Vertex shader → Fragment varying ----
varying vec3 vWorldPosition;
varying vec2 vWorldXZ;
varying vec2 vSampleWorldXZ;
varying float vWaveHeight;
varying float vClipDepth;
varying float vDisplacementY;

// uniform samplerCube uEnvironmentMap;

// ============================================================
// 1) 相机 / 光照（占位，由 ForwardRenderPass + LightSystem 每帧注入）
//    V   = normalize(uCameraPos - vWorldPosition)  视线
//    L   = uLightDir           surface → light
//    L_i = uLightRadiance      光源辐射度
//  L_pos = uLightPos   方向光的参考位置（本 shader 不用，备用于阴影）
// ============================================================
uniform vec3 uCameraPos;
uniform vec3 uLightDir;
uniform vec3 uLightRadiance;
// uniform vec3 uLightPos;

// ============================================================
// 2) Toggles（int 0|1；uniform 分支，driver 会把死路径 DCE）
//    uUseEnvironmentMap — 关闭 IBL specular（envReflect → 0）
//    uUseFoam           — 关闭 foam mask + 贴图采样 + 末尾混色
//    uUseFog            — 关闭大气透视 fog 混色
// ============================================================
uniform int uUseEnvironmentMap;
uniform int uUseFoam;
uniform int uUseFog;

// ============================================================
// 3) IBL 资源（由 loadFFTOceanScene 经 updateMaterialUniforms 注入）
//    uPrefilteredEnvMap — GGX 重要性采样卷积后的 cubemap
//                          mip-i ↔ roughness = i / (numMips - 1)
//    uBRDFLUT           — 2D LUT，u=NdotV，v=roughness
//                          RG = split-sum BRDF 积分的 (scale, bias)
//    uMaxReflectionLod  = numMips - 1，采样 lod 的 clamp 上限
// ============================================================
uniform samplerCube uPrefilteredEnvMap; // mip 0..N 对应 roughness 0..1
uniform sampler2D uBRDFLUT;
uniform float uMaxReflectionLod;

// ============================================================
// 4) Fresnel / 兜底环境色
//    uRefractiveIndex — η（水≈1.33）→ F0 = ((η-1)/(η+1))² ≈ 0.02
//    uAmbientColor    — IBL 关闭时给 SSS k4 用的环境兜底色
//                        （IBL 开启时被 prefiltered envmap 覆盖）
// ============================================================
uniform float uRefractiveIndex;
uniform vec3 uAmbientColor;

// ============================================================
// 5) Cook-Torrance（Beckmann NDF + Smith Schlick mask）
//
//    BRDF：f_r = D · F · G / (4 · (n·l) · (n·v))
//
//    uRoughness     — 微表面 RMS 斜率 m ∈ [0, 1]，影响三项：
//                       D: exp(-tan²θ_h / m²) / (π m² (n·h)⁴)
//                       G: Λ(a) ≈ 有理逼近, a = (h·o)/(m · sin θ)
//                       F: (1-n·v)^(5·e^(-2.69m)) / (1 + 22.7·m^1.5)
//
//    uFoamRoughness — foamMask=1 时叠加到 roughness 上的增量
//                       roughness_eff = uRoughness + foamMask · uFoamRoughness
//                       物理：泡沫=无数无序气泡 → 微表面取向高度无序 → m 增大
// ============================================================
uniform float uRoughness;
uniform float uFoamRoughness;

// ============================================================
// 6) Subsurface Scattering（4 项经验模型）
//
//    k1 = σ_peak · H · (L·-V)⁴ · (0.5 - 0.5·L·N)³    逆光波峰透光
//    k2 = σ_view · (V·N)²                             视线垂直穿水
//    k3 = σ_sh   · (N·L)                              类 Lambert
//    k4 = ρ_amb                                       环境散射
//
//    合成：
//      scatter = (k1·C_peak + k2·C_scat) · L_i / (1+Λ(l)) · S̃
//             +  k3·C_scat · L_i · S̃
//             +  k4·C_amb
//
//    uWavePeakScatterStrength — σ_peak  （k1）
//    uScatterStrength         — σ_view  （k2）
//    uScatterShadowStrength   — σ_sh    （k3）
//    uAmbientDensity          — ρ_amb   （k4）
//    uScatterColor            — C_scat  （k2/k3）
//    uScatterPeakColor        — C_peak  （k1）
//    uHeightStrength          — H 的缩放
//    uShadowIntensity         — 软阴影 lift：S̃ = sat(shadow + lift)
// ============================================================
uniform vec3 uScatterPeakColor; // k1
uniform vec3 uScatterColor; // k2/k3
uniform float uWavePeakScatterStrength; // k1
uniform float uScatterStrength; // k2

uniform float uScatterShadowStrength; // k3

uniform float uAmbientDensity; // k4

uniform float uShadowIntensity; // 软阴影 lift：S̃ = sat(shadow + lift)

uniform float uHeightStrength; // H 的缩放

// ============================================================
// 7) IBL specular 艺术增益（绕过物理）
//    envReflect *= uEnvirLightStrength
//    补偿 HDR 解码后亮度偏离与 tone-mapping 前的曝光
// ============================================================
uniform float uEnvirLightStrength;

// ============================================================
// 8) 法线缩放 / 远近衰减
//    uNormalStrength           — slope 的缩放（视觉粗糙感的总闸）
//    uDisplaceDepthAttenuation — k1 与 nMeso → nMacro 在 vClipDepth → 0
//                                 时的衰减曲线指数：factor = pow(vClipDepth, exp)
// ============================================================
uniform float uNormalStrength;
uniform float uDisplaceDepthAttenuation;

// ============================================================
// 9) 远场法线 / 噪声 mask（calcSurfaceByLayerSize 中的 varMask）
//
//    invDepth = clamp(pow(dist / 500 · Range, Power), 0, 1)
//    noise01  = uDisplacementMap0.y(worldXZ · 0.001 · TexScale) · 0.5 + 0.5
//    varMask  = sat(noise01 · 4.0 · invDepth)
//    finalSlope = mix(slopeAll, slopeHigh, varMask) · uNormalStrength
//
//    uVarMaskRange    — 远场过渡开始距离倍率（值大→更早开始过渡）
//    uVarMaskPower    — 过渡曲线锐度（值大→S 形更陡）
//    uVarMaskTexScale — 用 disp0.y 当 hash 时的 uv 缩放（控制斑块尺度）
// ============================================================
uniform float uVarMaskRange;
uniform float uVarMaskPower;
uniform float uVarMaskTexScale;

// ============================================================
// 10) Foam（颗粒贴图 + 颜色，受 uUseFoam 控制）
//
//    Jacobian < bias 在 compute pass 里写到 displacement.a；
//    本 shader 只负责"上色与混合"：
//      foamMask = Σ contribute_i · displacementMap_i.a
//      foamUV   = vWorldXZ · uFoamUVScale
//      foamLit  = uFoamMap(foamUV).rgb · uFoamColor · (L_i·NdotL + IBL_ambient)
//      color   := mix(color, foamLit, foamMask)
//
//    uFoamMap     — 占位，scene 阶段注入 1K 颗粒贴图
//    uFoamUVScale — uv = worldXZ · scale；scale 越大颗粒越细
//                    ⚠️ 太大会出现 tile 网格感
//    uFoamColor   — 染色（一般偏冷的微蓝白：[0.85, 0.9, 0.95]）
// ============================================================
uniform sampler2D uFoamMap;
uniform float uFoamUVScale;
uniform vec3 uFoamColor;

// ============================================================
// 11) Fog（atmospheric perspective，Beer-Lambert 简化形式，受 uUseFog 控制）
//
//    factor = 1 - exp(-(dist · density)^power)
//    color := mix(color, uFogColor, factor)
//
//    uFogColor   — horizon 蓝灰（[0.7, 0.78, 0.85] 是稳妥默认）
//    uFogDensity — 单位 1/m；0.004 ≈ 1/256m 处出现明显雾感
//    uFogPower   — 曲线弯曲度；1.0 = 标准 exp，>1 远雾更厚、近处更通透
// ============================================================
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uFogPower;

// ============================================================
// 12) Per-cascade 的 FFT 输出（i = 0..3）
//
//    uDisplacementMap[i]   — (Dx, Dy, Dz, foam)，layer-0 的 .y 即 H（波高）
//    uGradientMap[i]       — (∂Dy/∂x, ∂Dy/∂z)，用于重建 meso 法线
//    uDispDerivativeMap[i] — (∂Dx/∂x, ∂Dz/∂z, ∂Dx/∂z, ∂Dz/∂x)（.a = jacobian）
//    uLayerSize[i]         — 该层物理波长 L [m]，uv = worldXZ / L
//    uLayerContribute[i]   — 采样侧混合权重（艺术量，默认 1.0）
// ============================================================
uniform sampler2D uDisplacementMap0;
uniform sampler2D uDisplacementMap1;
uniform sampler2D uDisplacementMap2;
uniform sampler2D uDisplacementMap3;
uniform sampler2D uGradientMap0;
uniform sampler2D uGradientMap1;
uniform sampler2D uGradientMap2;
uniform sampler2D uGradientMap3;
uniform sampler2D uDispDerivativeMap0;
uniform sampler2D uDispDerivativeMap1;
uniform sampler2D uDispDerivativeMap2;
uniform sampler2D uDispDerivativeMap3;
// FFT 计算时的海面大小（区分于显示在屏幕上的海面 Mesh 的大小）
uniform float uLayerSize0;
uniform float uLayerSize1;
uniform float uLayerSize2;
uniform float uLayerSize3;

// ============================================================
// 每层 cascade 的采样侧混合权重（艺术量），默认 1.0
// ============================================================
uniform float uLayerContribute0;
uniform float uLayerContribute1;
uniform float uLayerContribute2;
uniform float uLayerContribute3;

// ============================================================
// 水深模型（目前 shader 未消费，保留兼容）
// ============================================================
// uniform int uDepthModel;
// uniform float uMaxDepth;
// uniform float uMinDepth;
// uniform vec2 uDepthCenter;
// uniform float uDepthFalloff;

// ============================================================
// 常量（经验拟合系数）
// ============================================================
const float PI = 3.14159265;
const float SCHLICK_A = 1.259;
const float SCHLICK_B = 0.396;
const float SCHLICK_C = 3.535;
const float SCHLICK_D = 2.181;
const float SCHLICK_CUTOFF = 1.6;
const float FRESNEL_ROUGH_EXP = 2.69;
const float FRESNEL_ENERGY_K = 22.7;
const float FRESNEL_ENERGY_P = 1.5;

// ==================== Helper ====================
// ---- 双曲正切的近似公式（预留） ----
float tanh_approx(float x) {
  // 简单的双曲正切近似
  float ex = exp(2.0 * x);
  return (ex - 1.0) / (ex + 1.0);
}

float hash12(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// ---- 轻量 value noise（预留） ----
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// ---- 简单 hash（预留） ----
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 78.233);
  return fract(p.x * p.y);
}

// ---- ACES Filmic Tone Mapping (Narkowicz 2015 近似) ----
/**
 * 输入：HDR linear radiance ∈ [0, +∞)
 * 输出：[0, 1] sRGB-ready linear（仍需后续 pow(1/2.2) 才能送显示器）
 *
 * 数学：fit 自 ACES RRT+ODT，相对 Reinhard 的关键差别：
 *   - 暗部 (x<0.05)：ACES 输出 ≈ 0.5·x（压暗 50%），Reinhard 几乎不动
 *   - 中部 (x≈1)：ACES ≈ 0.8（vs Reinhard 0.5）
 *   - 亮部 (x>5)：ACES → ~1（vs Reinhard 0.83）
 * 物理含义：S 形曲线，模仿电影胶片的"暗中带细节、亮处不爆"
 */
vec3 ACESFilm(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp(x * (a * x + b) / (x * (c * x + d) + e), 0.0, 1.0);
}

// ==================== Sample: layer size method ====================
vec2 sampleLayerSlopeByLayerSize(sampler2D gradMap, float layerSize, float contribute) {
  vec2 uv = vSampleWorldXZ / layerSize;
  return texture2DLodEXT(gradMap, uv, 0.0).rg * contribute; // 强制 mip 0
}

float sampleLayerJacobianByLayerSize(sampler2D dispDerivMap, float layerSize, float contribute) {
  vec2 uv = vSampleWorldXZ / layerSize;
  return mix(1.0, texture2DLodEXT(dispDerivMap, uv, 0.0).a, contribute); // 强制 mip 0
}

// ==================== Normal & Slope & Jacobian ====================
// 原始平面上的点 (x, 0, z) 经过位移后变成: P(x,z) = (x + Dx(x,z),  Dy(x,z),  z + Dz(x,z))
// 要求法线，需要两个切向量: ∂P/∂x = (1 + ∂Dx/∂x, ∂Dy/∂x, ∂Dz/∂x) = (1 + dDx_dx, slope.x, dDz_dx) 和 ∂P/∂z = (∂Dx/∂z, ∂Dy/∂z, 1 + ∂Dz/∂z) = (dDx_dz, slope.y, 1 + dDz_dz)
struct SurfaceData {
  vec2 slope;
  vec3 normal;
  float jacobian;
};

SurfaceData calcSurfaceByLayerSize() {
  vec2 slope0 = sampleLayerSlopeByLayerSize(uGradientMap0, uLayerSize0, uLayerContribute0);
  vec2 slope1 = sampleLayerSlopeByLayerSize(uGradientMap1, uLayerSize1, uLayerContribute1);
  vec2 slope2 = sampleLayerSlopeByLayerSize(uGradientMap2, uLayerSize2, uLayerContribute2);
  vec2 slope3 = sampleLayerSlopeByLayerSize(uGradientMap3, uLayerSize3, uLayerContribute3);

  vec2 slopeAll = slope0 + slope1 + slope2 + slope3;
  vec2 slopeLow = slope0 + slope1;
  vec2 slopeHigh = slope2 + slope3;

  // ---- 距离淡入：近处 0、远处 1 ----
  float dist = length(uCameraPos.xz - vWorldPosition.xz); // 相机到 fragment 水平距离 [m]
  /**
 * invDepth 是"距离权重"：0 = 近、1 = 远
 *  ‐ dist / 500 把距离单位化到 [0, 1] 量级（500m 是经验基准）
 *  ‐ uVarMaskRange 放大或缩小过渡发生的距离
 *      (Range 大 → 早开始过渡；Range 小 → 推迟过渡)
 *  ‐ pow(_, Power) 控制过渡形状
 *      (Power 大 → S 形锐利；Power 小 → 线性)
 */
  float invDepth = clamp(pow(dist / 500.0 * uVarMaskRange, uVarMaskPower), 0.0, 1.0);
  // invDepth = clamp(invDepth, 0.0, 1.0);

  // ---- 噪声源：用 layer-0 displacement.y 做空间随机 ----
  // 0.001 * uVarMaskTexScale 让斑点尺度落到几百米量级（参考的 uv/1000）
  float noiseRaw = texture2DLodEXT(uDisplacementMap0, vWorldXZ * 0.001 * uVarMaskTexScale, 0.0).y;
  /**
 * noise01 是"空间随机"：用 layer-0 displacement.y 当 hash 源
 *   ‐ 0.001 * uVarMaskTexScale 把采样 uv 拉到很大的尺度（让斑点尺度是百米量级）
 *   ‐ * 0.5 + 0.5：把 displacement.y 的有符号米级数值映射到 [0, 1]
 *  作用：让"远场切换"不是均匀地刷一片，而是带空间斑块感
 */
  float noise01 = clamp(noiseRaw * 0.5 + 0.5, 0.0, 1.0);

  // ---- 二值化 ----
  // * 4.0 是把 noise01 拉到大部分 saturate 到 1，少部分留在 0
  // * invDepth 让斑块只在远场生效
  float varMask = clamp(noise01 * 4.0 * invDepth, 0.0, 1.0);

  // NormalStrength 缩放
  vec2 finalSlope = mix(slopeAll, slopeHigh, varMask) * uNormalStrength;
  // vec2 finalSlope = slopeAll * uNormalStrength;

  // vec3 tangentX = vec3(1.0 + dDx_dx, grad.x, dDz_dx);
  // vec3 tangentZ = vec3(dDx_dz, grad.y, 1.0 + dDz_dz);
  // vec3 n = normalize(cross(tangentZ, tangentX));
  vec3 n = normalize(vec3(-finalSlope.x, 1, -finalSlope.y));

  float j0 = sampleLayerJacobianByLayerSize(uDispDerivativeMap0, uLayerSize0, uLayerContribute0);
  float j1 = sampleLayerJacobianByLayerSize(uDispDerivativeMap1, uLayerSize1, uLayerContribute1);
  float j2 = sampleLayerJacobianByLayerSize(uDispDerivativeMap2, uLayerSize2, uLayerContribute2);
  float j3 = sampleLayerJacobianByLayerSize(uDispDerivativeMap3, uLayerSize3, uLayerContribute3);

  float jacobian = j0 * j1 * j2 * j3;

  SurfaceData sd;
  sd.slope = finalSlope;
  sd.normal = n;
  sd.jacobian = jacobian;

  return sd;
}

// ============================================================
// Cook-Torrance (Beckmann + Smith)
//   f_r = D·F·G / ( 4·(n·l)·(n·v) )
//   这里 n 取 meso（中观）法线，分母的 (n·l) 换成 macro 法线以避免除零
// ============================================================

// ---- D：Beckmann 法线分布 ----
// D(h) = exp( ((n·h)^2 - 1) / (m^2 (n·h)^2) ) / ( π m^2 (n·h)^4 )
// 物理含义：微表面法线在 h 方向上的分布密度；m 越大表面越粗糙
// m -- roughness
float BeckmannNDF(float nDoth, float roughness) {
  float nh2 = nDoth * nDoth;
  float roughness2 = roughness * roughness;
  float expArg = (nh2 - 1.0) / (roughness2 * nh2); // = -tan²θ_h / m²
  return exp(expArg) / (PI * roughness2 * nh2 * nh2);
}

// ---- G：Smith-Beckmann 单侧 Λ(o)，Schlick 有理逼近 ----
// a = (h·o) / ( m · sqrt(1 - (h·o)^2) )
// Λ(o) ≈ (1 - 1.259a + 0.396a²) / (3.535a + 2.181a²)   when a < 1.6
//       ≈ 0                                             when a ≥ 1.6
// m -- roughness
// 物理含义：从 o 方向看，有多大比例的微表面被自身其它微表面遮蔽
float SmithMaskBeckmann(vec3 h, vec3 o, float m) {
  float hDoto = max(0.001, clamp(dot(h, o), 0.0, 1.0));
  float a = hDoto / (m * sqrt(max(1.0 - hDoto * hDoto, 1e-5)));

  float a2 = a * a;
  if (a >= SCHLICK_CUTOFF) return 0.0;
  return (1.0 - SCHLICK_A * a + SCHLICK_B * a2) / (SCHLICK_C * a + SCHLICK_D * a2);
}

// ---- F：粗糙度修正 Schlick Fresnel ----
// F0 = ((η-1)/(η+1))²
// F  = F0 + (1-F0) · (1-n·v)^(5·e^(-2.69m)) / (1 + 22.7·m^1.5)
// 物理含义：入射光在水面反射的比例，随 grazing angle 增大
float FresnelSchlickRough(vec3 normal, vec3 viewDir, float roughness, float eta) {
  float F0 = (eta - 1.0) / (eta + 1.0);
  F0 = F0 * F0;
  // float cosNV = max(dot(normal, viewDir), 0.0);
  float cosNV = max(dot(normal, viewDir), 0.1);
  float expo = 5.0 * exp(-FRESNEL_ROUGH_EXP * roughness); // 粗糙度让曲线变缓
  float num = pow(1.0 - cosNV, expo);
  float denom = 1.0 + FRESNEL_ENERGY_K * pow(roughness, FRESNEL_ENERGY_P); // 能量归一化
  return clamp(F0 + (1.0 - F0) * num / denom, 0.0, 1.0);
}

// ---- 组装 specular ----
// L_spec = D·F·G·Li·S / ( 4·(n_macro·l) )  · (n_meso·l)
// 用 n_macro 归一化避免掠射角除零爆点；再乘回 n_meso·l 恢复几何朝向
vec3 cookTorranceSpecular(
  vec3 nMeso,
  vec3 nMacro,
  vec3 lightDir,
  vec3 viewDir,
  vec3 lightColor,
  float roughness,
  float eta,
  float shadow
) {
  vec3 halfDir = normalize(lightDir + viewDir);
  float nDoth = max(dot(nMeso, halfDir), 0.001);
  float nDotl_m = max(dot(nMeso, lightDir), 0.001);
  float nDotl_M = max(dot(nMacro, lightDir), 0.001);

  float D = BeckmannNDF(nDoth, roughness);
  float F = FresnelSchlickRough(nMeso, viewDir, roughness, eta);
  // prettier-ignore
  float G = 1.0 / (1.0
           + SmithMaskBeckmann(halfDir, viewDir, roughness)   // Λ(v) masking
           + SmithMaskBeckmann(halfDir, lightDir, roughness)); // Λ(l) shadowing

  return lightColor * (D * F * G) / (4.0 * nDotl_M) * nDotl_m * shadow;
}

// ============================================================
// Subsurface Scattering (四项经验模型)
//
// k1：波峰峰值散射（逆光波峰透光）
//   k1 = σ_peak · H · (L·-V)^4 · (0.5 - 0.5·L·N)^3
// k2：视角体散射  k2 = σ_view · (V·N)^2
// k3：方向漫射    k3 = σ_sh   · (N·L)
// k4：环境散射    k4 = ρ_amb  （后面乘 ambientColor）
//
// 合成：
//   scatter = (k1·C_peak + k2·C_scat)·Li/(1+Λ(l))·S̃
//           +  k3·C_scat·Li·S̃
//           +  k4·C_amb
// ============================================================
vec3 subsurfaceScattering(
  vec3 nMeso,
  vec3 L,
  vec3 V,
  float waveHeight,
  vec3 lightColor,
  vec3 ambientColor,
  float shadow,
  float shadowLift,
  float lightMask
) {
  float LdotN = dot(L, nMeso);
  float LdotNegV = max(dot(L, -V), 0.0); // 保证 pow 的底数 ≥ 0 以防 NaN
  float VdotN = max(dot(V, nMeso), 0.0); // 保证 pow 的底数 ≥ 0 以防 NaN
  float NdotL = max(dot(nMeso, L), 0.0); // 保证 pow 的底数 ≥ 0 以防 NaN

  // 物理含义：波面越斜（normal 偏离 +Y 越多）→ 视线穿水路径越短 → 越亮、偏 peak
  // 波平区（缓坡或波顶 / 波谷的"平"处）→ 保持深色 scatter base
  float slopeProxy = clamp(1.0 - dot(nMeso, vec3(0.0, 1.0, 0.0)), 0.0, 1.0); // 波面倾斜度 ∈[0,1]
  // 这一点有多算波峰/陡坡 → 越接近 1，散射色越往青绿（peakColor）混
  // 由 smoothstep(0.02, 0.5, slopeProxy) 的两个阈值控制：
  //  - 下阈 0.02：slopeProxy 超过 0.02（很缓的坡）就开始变绿
  //  - 上阈 0.5：slopeProxy 到 0.5（很陡）就完全是 peakColor
  float waterDepthMask = smoothstep(0.02, 0.5, slopeProxy);
  vec3 scatterColor = mix(uScatterColor, uScatterPeakColor * 0.8, waterDepthMask); // k2/k3
  vec3 peakColor = mix(uScatterPeakColor, uScatterPeakColor * 1.2, waterDepthMask); // k1

  // vec3 scatterColor = uScatterColor;
  // vec3 peakColor = uScatterPeakColor;

  // k1：H 越高、越逆光（L·-V↑）、光越从背面穿来（L·N→-1）时越亮
  float k1 = uWavePeakScatterStrength * waveHeight * pow(LdotNegV, 4.0) * pow(0.5 - 0.5 * LdotN, 3.0);
  // float k1 = uWavePeakScatterStrength * waveHeight * pow(max(0.0, LdotNegV), 4.0) * pow(0.5 - 0.5 * LdotN, 3.0); // deprecated
  k1 = mix(0.0, k1, pow(clamp(vClipDepth, 0.0, 1.0), uDisplaceDepthAttenuation));

  // k2：视线越垂直穿过水体（V·N 大），散射越强
  float k2 = uScatterStrength * pow(VdotN, 2.0);
  // float k2 = uScatterStrength * pow(max(0.0, VdotN), 2.0); // deprecated

  // k3：类 Lambert，随光源入射角变化
  // float k3 = uScatterShadowStrength * clamp(NdotL, 0.3, 1.0);
  float k3 = uScatterShadowStrength * NdotL;

  // k4：恒定环境散射权重
  float k4 = uAmbientDensity;

  // 软化阴影：shadow=0 仍保留 shadowLift 的散射亮度
  float softShadow = clamp(shadow + shadowLift, 0.0, 1.0);

  // prettier-ignore
  vec3 scatter = (k1 * peakColor + k2 * scatterColor)
               * lightColor
               * (1.0 / (1.0 + lightMask))   // 光源端 masking
               * softShadow;

  scatter += k3 * scatterColor * lightColor * softShadow;
  scatter += k4 * ambientColor;
  return scatter;
}

// =====================================================================
// IBL specular（split-sum 近似）
// 物理：∫ L_i · f_spec · cos θ dω
//      ≈ [按 roughness 采 prefilteredEnv] · [BRDF LUT 给的 (scale, bias)]
//
// reflectDir = reflect(-V, N)        view 反射方向，用于 envmap 采样
// uRoughness                         材质粗糙度 ∈ [0, 1]
// NdotV                              视角与法线夹角余弦
// F0                                 水的菲涅尔基色（n=1.33 推出 ≈ 0.02）
// =====================================================================
vec3 calEnvReflect(vec3 normal, vec3 viewDir, vec3 reflectDir) {
  float NdotV = max(dot(normal, viewDir), 0.0);

  // ---- 1) 按 roughness 选 mip level ----
  // mip 0 = 完全镜面、mip max = 完全粗糙
  float lod = uRoughness * uMaxReflectionLod;
  vec3 prefilteredColor = textureCubeLodEXT(uPrefilteredEnvMap, reflectDir, lod).rgb;

  // ---- 2) 从 LUT 查 BRDF 积分的 (scale, bias) ----
  vec2 envBRDF = texture2D(uBRDFLUT, vec2(NdotV, uRoughness)).rg;

  // ---- 3) Fresnel F0：水的折射率 ----
  // n ≈ 1.33 → F0 = ((n-1)/(n+1))² ≈ 0.02
  vec3 F0 = vec3(0.02); // 水是无色电介质，三通道相同

  // ---- 4) split-sum 合成 ----
  // iblSpec = prefilteredColor · (F0 · scale + bias)
  vec3 envReflect =
    uUseEnvironmentMap == 1
      ? prefilteredColor * (F0 * envBRDF.x + envBRDF.y) * uEnvirLightStrength
      : vec3(0.0);

  return envReflect;
}

// ============================================================
// Foam mask：从 4 层 cascade 的 displacement.a 加权求和
// Jacobian 描述“局部压缩”，理论上 J≤0 才会破碎产生泡沫，
// 但实际渲染中用 J < bias 提前触发，从而得到稳定、连续且视觉合理的泡沫分布
// ============================================================
float calcFoamMaskByLayerSize(float shadow) {
  // float foam =
  //   uLayerContribute0 * texture2DLodEXT(uDisplacementMap0, vSampleWorldXZ / uLayerSize0, 0.0).a +
  //   uLayerContribute1 * texture2DLodEXT(uDisplacementMap1, vSampleWorldXZ / uLayerSize1, 0.0).a +
  //   uLayerContribute2 * texture2DLodEXT(uDisplacementMap2, vSampleWorldXZ / uLayerSize2, 0.0).a +
  //   uLayerContribute3 * texture2DLodEXT(uDisplacementMap3, vSampleWorldXZ / uLayerSize3, 0.0).a;

  float foam =
    uLayerContribute0 * texture2D(uDisplacementMap0, vSampleWorldXZ / uLayerSize0).a +
    uLayerContribute1 * texture2D(uDisplacementMap1, vSampleWorldXZ / uLayerSize1).a +
    uLayerContribute2 * texture2D(uDisplacementMap2, vSampleWorldXZ / uLayerSize2).a +
    uLayerContribute3 * texture2D(uDisplacementMap3, vSampleWorldXZ / uLayerSize3).a;
  foam = clamp(foam, 0.0, 1.0);
  // 阴影软化
  foam *= clamp(shadow + uShadowIntensity, 0.0, 1.0);
  return foam;
}

void main() {
  SurfaceData surf;
  surf = calcSurfaceByLayerSize();

  // ---- normal ----
  vec3 nMacro = vec3(0.0, 1.0, 0.0);
  vec3 nMeso = surf.normal;
  nMeso = mix(nMacro, nMeso, pow(clamp(vClipDepth, 0.0, 1.0), uDisplaceDepthAttenuation));
  nMeso = normalize(uNormalMatrix * nMeso);

  // ---- vectors / direction ----
  vec3 viewDir = normalize(uCameraPos - vWorldPosition);
  vec3 lightDir = normalize(uLightDir);
  vec3 halfDir = normalize(viewDir + lightDir);
  vec3 reflectDir = normalize(reflect(-viewDir, nMeso));

  // ---- foam ----
  // J=1 时平衡，J 越小越压缩 → foam 累积
  float shadow = 1.0;
  float foamMask = calcFoamMaskByLayerSize(shadow);
  // foamMask = clamp(foamMask * 1.5, 0.0, 1.0);

  // ---- roughness ----
  // 物理含义：foam 是无数小气泡 + 破碎水沫，微表面取向高度无序 → 等效 roughness 大
  //   foamMask = 0 → roughness = uRoughness（平静水的镜面感）
  //   foamMask = 1 → roughness = uRoughness + uFoamRoughness（完全 foam，几乎无镜面）
  float roughness = uRoughness + foamMask * uFoamRoughness;

  // ---- mask ----
  // 复用 Λ(l)，给 SSS 使用
  float lightMask = SmithMaskBeckmann(halfDir, lightDir, roughness);
  float viewMask = SmithMaskBeckmann(halfDir, viewDir, roughness);
  float geometryMask = 1.0 / (1.0 + viewMask + lightMask);

  // ---- Fresnel（specular 与合成共用同一次计算即可） ----
  float fresnel = FresnelSchlickRough(nMeso, viewDir, roughness, uRefractiveIndex);

  // ---- specular ----
  vec3 specular = cookTorranceSpecular(
    nMeso,
    nMacro,
    lightDir,
    viewDir,
    uLightRadiance,
    roughness,
    uRefractiveIndex,
    1.0 // shadow
  );

  // ---- scattering ----
  float var_H = max(0.0, vWaveHeight) * uHeightStrength;
  // 动态从 prefiltered envmap 查环境漫反射（代替静态 uAmbientColor）
  vec3 ambientColor = textureCubeLodEXT(uPrefilteredEnvMap, nMeso, uMaxReflectionLod).rgb;

  vec3 scattering = subsurfaceScattering(
    nMeso,
    lightDir,
    viewDir,
    var_H,
    uLightRadiance,
    // uAmbientColor,
    ambientColor,
    1.0, // shadow
    uShadowIntensity,
    lightMask
  );

  // ---- environment reflect ----
  vec3 envReflect = calEnvReflect(nMeso, viewDir, reflectDir);

  // ---- 光的叠加 ----
  // vec3 color = (1.0 - fresnel) * scattering;
  vec3 color = (1.0 - fresnel) * scattering + specular + envReflect;

  // ---- foam：贴图采样 + 混色（受 uUseFoam 控制） ----
  if (uUseFoam == 1) {
    vec2 foamUV = vWorldXZ * uFoamUVScale; // 让 UV 在世界空间稳定（不随相机/网格 LOD 漂移）
    vec3 foamAlbedo = texture2D(uFoamMap, foamUV).rgb;
    float NdotL = max(0.0, dot(nMeso, lightDir));
    // IBL ambient
    vec3 foamIBL = textureCubeLodEXT(uPrefilteredEnvMap, nMeso, uMaxReflectionLod).rgb;
    vec3 foamLit = foamAlbedo * uFoamColor * (uLightRadiance * NdotL + foamIBL);

    // 用 Rec.709 线性亮度当灰度，对任何颜色的 albedo 都成立
    float foamTexAlpha = dot(foamAlbedo, vec3(0.2126, 0.7152, 0.0722));
    float foamCoverage = foamMask * mix(0.7, 1.0, foamTexAlpha);

    color = mix(color, foamLit, foamCoverage);
    // color = mix(color, foamLit, foamMask);
  }

  // ---- fog: Atmospheric perspective（受 uUseFog 控制） ----
  /**
 * 物理含义：光从远处水面传到相机，要穿过 d 米空气，每 m 损失一点能量并混入大气底色
 *  - color_final = mix(color, fogColor, 1 - exp(-d / falloff))
 *  - falloff 越小越雾，越大越透
 */
  if (uUseFog == 1) {
    float dist = length(uCameraPos - vWorldPosition); // 米
    float fogFactor = 1.0 - exp(-pow(dist * uFogDensity, uFogPower));
    color = mix(color, uFogColor, fogFactor);
  }

  // ---- HDR → SDR tone mapping ----
  // 曝光下推：让 ACES 工作在略欠曝区间，保 shadow 深、保 highlight 不爆
  const float exposure = 0.8;
  color *= exposure;

  // ACES filmic（S 形，shadow 压暗、highlight 自然 roll-off）
  color = ACESFilm(color);

  // sRGB gamma 编码（必须做，否则显示器二次解码导致整体压暗）
  color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));

  // ---- 最终输出 ----
  float alpha = 1.0;
  gl_FragColor = vec4(color, alpha);

  // ---- debug 输出（取消注释启用） ----
  // gl_FragColor = vec4(nMeso.xzy * 0.5 + 0.5, 1.0);
  // gl_FragColor = vec4(scattering, 1.0);
  // gl_FragColor = vec4(specular, 1.0);
  // gl_FragColor = vec4(envReflect, 1.0);
  // gl_FragColor = vec4(vec3(foamMask), 1.0);
  // gl_FragColor = vec4(vec3(foamLit), 1.0);
  // gl_FragColor = vec4(vec3(1.0 - fresnel), 1.0);
  // gl_FragColor = vec4(vec3(surf.jacobian), 1.0);
  // debug: 显示 meso 法线偏离 macro 的程度
  float deviation = 1.0 - dot(nMeso, nMacro);
  // 三档显色：黑=正常、灰=合理陡、红=可疑 artifact
  vec3 dbg;
  float kinkMag = length(dFdx(nMeso)) + length(dFdy(nMeso));
  // 分档显色：
  //   黑 (< 0.05)   = 平静区
  //   蓝 (0.05-0.2) = 大/中波缓坡（正常）
  //   绿 (0.2-0.5)  = 毛细波 / 中等陡坡（正常）
  //   黄 (0.5-1.5)  = 高陡度（可能正常，可能 artifact 边界）
  //   红 (> 1.5)    = 几乎确定是 artifact 或 fold
  if (kinkMag > 1.5) dbg = vec3(1.0, 0.0, 0.0);
  else if (kinkMag > 0.5) dbg = vec3(1.0, 1.0, 0.0);
  else if (kinkMag > 0.2) dbg = vec3(0.0, 1.0, 0.0);
  else if (kinkMag > 0.05) dbg = vec3(0.0, 0.0, 1.0);
  else dbg = vec3(0.0);
  // gl_FragColor = vec4(dbg, 1.0);
}
