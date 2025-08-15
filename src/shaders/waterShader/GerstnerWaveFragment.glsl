#ifdef GL_ES
precision highp float;
#endif

// 从 Vertex shader 传入的 Fragment varying
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vTexCoord;
varying vec3 vWorldPosition;
varying float vWaveHeight;
varying float vWaterDepth;
varying float vJacobian;

// Camera 位置
uniform vec3 uCameraPos;

// 水体颜色参数
uniform vec3 uWaterColor;
uniform vec3 uDeepWaterColor;
uniform vec3 uShallowWaterColor;
// 水体物理参数
uniform float uTransparency;
uniform float uReflectance;
uniform float uRefractiveIndex;
// 光照参数
uniform vec3 uLightColor;
uniform vec3 uLightPos;
uniform vec3 uLightDir;
uniform float uSpecularPower;
uniform float uFresnelPower;

// 波浪控制参数
uniform float uTime;

// Textures
uniform sampler2D uDiffuseMap;
uniform sampler2D uNormalMap;
uniform samplerCube uEnvironmentMap;
uniform int uUseDiffuseMap;
uniform int uUseNormalMap;
uniform int uUseEnvironmentMap;

// 材质属性修正：水的真实物理参数
const float WATER_IOR = 1.33; // 水的折射率
const float AIR_IOR = 1.0; // 空气折射率
const float WATER_METALLIC = 0.02; // 水的金属度（几乎为非金属）
const float WATER_BASE_ROUGHNESS = 0.008; // 水的基础粗糙度（非常光滑）
const vec3 WATER_F0 = vec3(0.02); // 水的基础反射率

// 深度和颜色参数
const float DEPTH_ATTENUATION = 0.05; // 深度衰减系数
const float FOAM_THRESHOLD = 0.4; // 泡沫阈值

// Constant
#define M_PI 3.1415926535897932384626433832795
#define TWO_PI 6.283185307
#define INV_PI 0.31830988618
#define INV_TWO_PI 0.15915494309

// ====================== 以下：Cook-Torrance 模型 ======================
// 头部声明
vec3 fresnelSchlick(float cosTheta, vec3 F0, float fresnelPower);
float distributionGGX(vec3 normal, vec3 halfwayVector, float roughness);
float GeometrySmith(vec3 normal, vec3 viewDir, vec3 lightDir, float roughness);

/**
 * === Cook-Torrance 模型 -- 基于渲染方程的 PBR 模型 ===
 *
 * 基于物理的渲染方程实现:
 *  
 *  Lo(p,ωo) = ∫Ω (kd*c/π + ks*DFG/[4(ωo·n)(ωi·n)]) * Li(p,ωi) * (n·ωi) dωi
 *  变量说明:
 *   - kd/ks: 漫反射/镜面反射系数
 *   - c: albedo颜色 (RGB)
 *   - n: 单位法向量
 *   - ωi: 入射方向向量 (单位向量)
 *   - ωo: 出射方向向量 (单位向量)
 *   - Li: 入射光强度
 */
vec3 CookTorranceRadiance(
  vec3 albedo,
  float metallic,
  float roughness,
  vec3 normal,
  vec3 viewDir,
  vec3 lightDir,
  vec3 inputRadiance,
  float fresnelPower
) {
  vec3 F0 = vec3(0.02);
  F0 = mix(F0, albedo, metallic);

  vec3 halfwayVector = normalize(viewDir + lightDir);
  float cosTheta = max(dot(normal, lightDir), 0.0);

  float D = distributionGGX(normal, halfwayVector, roughness);
  vec3 F = fresnelSchlick(cosTheta, F0, fresnelPower);
  float G = GeometrySmith(normal, viewDir, lightDir, roughness);

  // specular
  vec3 nominator = D * G * F;
  float denominator = 4.0 * max(dot(normal, viewDir), 0.0) * max(dot(normal, lightDir), 0.0) + 0.001;
  vec3 specular = nominator / denominator;

  // diffuse
  vec3 ks = F;
  vec3 kd = (1.0 - metallic) * (vec3(1.0) - ks) * 0.015; // 极小的漫反射系数
  vec3 diffuse = kd * albedo / M_PI;

  float NdotL = max(dot(normal, lightDir), 0.0);

  return (diffuse + specular) * inputRadiance * NdotL;
}

/**
 * ===  Cook-Torrance diffuse BRDF 项 ===
 *  
 * kd * c / π
 */
vec3 CookTorranceDiffuseBRDF(
  vec3 albedo,
  float metallic,
  vec3 normal,
  vec3 viewDir,
  vec3 lightDir,
  float fresnelPower
) {
  vec3 F0 = vec3(0.02);
  F0 = mix(F0, albedo, metallic);
  float cosTheta = max(dot(normal, lightDir), 0.0);

  vec3 F = fresnelSchlick(cosTheta, F0, fresnelPower);
  vec3 ks = F;
  vec3 kd = (1.0 - metallic) * (vec3(1.0) - ks);
  // diffuse
  vec3 diffuse = kd * albedo / M_PI;

  return diffuse;
}

/**
 * === Cook-Torrance specular BRDF项 ===
 *
 *  DFG / [4(ωo·n)(ωi·n)]
 *
 *   - DFG: 微表面模型的三个核心函数乘积
 *     * D (Normal Distribution Function): 微表面法线分布函数（例：GGX）
 *     * F (Fresnel Equation): 菲涅尔反射率（例：Schlick近似）
 *     * G (Geometry Function): 几何遮蔽函数（例：Smith模型）
 *   - ωo·n: 观察方向与法线的点积（cosθo，θo为观察角）
 *   - ωi·n: 入射方向与法线的点积（cosθi，θi为入射角）
 *   - 分母4(ωo·n)(ωi·n): 能量守恒校正因子，补偿微表面模型的双重几何衰减
 *
 *  典型实现参考（以GGX为例）:
 *  
 *    - D(n,h,α) = α² / [π((n·h)²(α²−1)+1)²]  // h为半角向量
 *    - F(v,h,f0) = f0 + (1−f0)(1−(v·h))⁵     // f0为基础反射率
 *    - G(l,v,n,α) = G1(l) * G1(v)            // 分离遮蔽阴影
 *    G1(v) = (n·v) / [(n·v)(1−k)+k]           // k = α/2
 */
vec3 CookTorranceSpecularBRDF(
  vec3 albedo,
  float roughness,
  float metallic,
  vec3 normal,
  vec3 viewDir,
  vec3 lightDir,
  float fresnelPower
) {
  vec3 F0 = vec3(0.02);
  F0 = mix(F0, albedo, metallic);
  float cosTheta = max(dot(normal, lightDir), 0.0);
  vec3 halfwayVector = normalize(viewDir + lightDir);

  vec3 F = fresnelSchlick(cosTheta, F0, fresnelPower);
  float D = distributionGGX(normal, halfwayVector, roughness);
  float G = GeometrySmith(normal, viewDir, lightDir, roughness);

  // specular
  vec3 nominator = D * G * F;
  float denominator = 4.0 * max(dot(normal, viewDir), 0.0) * max(dot(normal, lightDir), 0.0) + 0.001;
  vec3 specular = nominator / denominator;

  return specular;
}

/**
 * === F (Fresnel Equation): 菲涅尔反射率 ===
 *
 *  F(v,h,F0) = F0 + (1−F0)(1−(v·h))⁵
 *  
 *   - v​​：观察方向向量（从表面指向相机）
 *   - h​​：半程向量 Halfway Vector
 *  
 * 首先我们想计算的是镜面反射和漫反射之间的比值，或者说与表面折射的光线相比，它反射了多少光线。
 * Fresnel-Schlick近似法接收一个参数F0，被称为0°入射角的反射率，或者说是直接(垂直)观察表面时有多少光线会被反射。
 * 这个参数F0会因为材料不同而不同，而且对于金属材质会带有颜色。在PBR金属流中我们简单地认为大多数的绝缘体在F0为0.04的时候看起来视觉上是正确的，对于金属表面我们根据反射率特别地指定F0。
 */
vec3 fresnelSchlick(float cosTheta, vec3 F0, float fresnelPower) {
  // return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0); // clamp 是防御式编程，避免 cosTheta 精度问题使得 1.0 - cosTheta < 0.0 从而带来的黑点
  // return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), fresnelPower);

  // 计算垂直入射时的反射率
  F0 = vec3(pow((AIR_IOR - WATER_IOR) / (AIR_IOR + WATER_IOR), 2.0));
  // Schlick近似的菲涅尔公式
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}
/**
 * 考虑粗糙度的菲涅尔（用于环境光）
 * 参考：Sébastien Lagarde的改进公式
 */
vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {
  return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}
/**
 * === D (Normal Distribution Function): 微表面法线分布函数 ===
 *  
 *  α² / [π((n·h)²(α²−1)+1)²]
 *  
 *   - ​​α​​：粗糙度参数（Roughness），取值范围 [0,1]，通常由粗糙度贴图采样得到。低粗糙度（α→0）法线集中，形成锐利高光；高粗糙度（α→1）法线分散，形成模糊高光。α = Roughness²，平方操作增强粗糙度的非线性效果
 *   - α²​​：粗糙度的平方，用于控制微表面法线分布的集中程度。
 *   - n​​：表面宏观法线向量。
 *   - h​​：半程向量 Halfway Vector
 */
float distributionGGX(vec3 normal, vec3 halfwayVector, float roughness) {
  float alpha = roughness * roughness;
  float alpha2 = alpha * alpha;
  float NdotH = dot(normal, halfwayVector);
  float NdotH2 = NdotH * NdotH;

  float numerator = alpha2;
  float denominator = NdotH2 * (alpha2 - 1.0) + 1.0;
  denominator = M_PI * denominator * denominator;

  return numerator / denominator;
}

/**
 * === G (Geometry Function): 几何遮蔽函数 ===
 *  
 * G(l,v,n,α) = G1(l) * G1(v)   // 分离遮蔽阴影
 *  
 *   - G1(v) = (n·v) / [(n·v)(1−k)+k]   // k = α/2
 */
float GeometrySchlickGGX(float NdotV, float roughness) {
  float r = roughness + 1.0;
  float k = r * r / 8.0;

  float numerator = NdotV;
  float denominator = NdotV * (1.0 - k) + k;

  return numerator / denominator;
}
float GeometrySmith(vec3 normal, vec3 viewDir, vec3 lightDir, float roughness) {
  float NdotV = max(dot(normal, viewDir), 0.0);
  float NdotL = max(dot(normal, lightDir), 0.0);
  float ggx2 = GeometrySchlickGGX(NdotV, roughness);
  float ggx1 = GeometrySchlickGGX(NdotL, roughness);

  return ggx1 * ggx2;
}
// ====================== 以上：Cook-Torrance 模型 ======================

// ====================== 以下：水体颜色 ======================
/**
 * === 水体特效：深度颜色混合 ===
 *
 * 模拟光在水中的指数衰减：
 * I(d) = I₀ × e^(-αd)
 *
 * 其中：
 * - d = 深度
 * - α = 衰减系数（不同波长的光衰减率不同）
 */
vec3 calculateDepthColor(vec3 baseColor, float depth) {
  vec3 shallowColor = uShallowWaterColor;
  vec3 deepColor = uDeepWaterColor;

  // 指数衰减模拟光在水中的传播
  // DEPTH_ATTENUATION 越大，exp(-depth * DEPTH_ATTENUATION) 越小，depthFactor 越大
  float depthFactor = 1.0 - exp(-depth * DEPTH_ATTENUATION);

  // depthFactor 越大，deepColor 占比越多
  // DEPTH_ATTENUATION 越大，deepColor 占比越多
  return mix(shallowColor, deepColor, depthFactor);
}
/**
 * 增强的深度颜色计算
 */
vec3 calculateEnhancedDepthColor(vec3 baseColor, float depth, vec2 worldPos, float time) {
  // 基础深度颜色
  vec3 shallowColor = uShallowWaterColor;
  vec3 deepColor = uDeepWaterColor;

  float depthFactor = 1.0 - exp(-depth * DEPTH_ATTENUATION);
  vec3 depthColor = mix(shallowColor, deepColor, depthFactor);

  // 添加水藻和底部反射的变化
  vec2 algaeUV = worldPos * 0.05 + time * 0.02;
  float algaePattern = sin(algaeUV.x * 10.0) * cos(algaeUV.y * 8.0) * 0.5 + 0.5;
  algaePattern = smoothstep(0.3, 0.7, algaePattern);

  vec3 algaeColor = vec3(0.2, 0.5, 0.3);
  depthColor = mix(depthColor, algaeColor, algaePattern * 0.2 * (1.0 - depthFactor));

  return depthColor;
}

// 颜色深度衰减，模拟不同波长光在水中的不同衰减率
vec3 applyWaterColorAttenuation(vec3 color, float depth) {
  // 红、绿、蓝光的衰减系数（红光衰减最快）
  vec3 attenuationCoeff = vec3(0.3, 0.1, 0.05);

  // 应用指数衰减
  vec3 attenuation = exp(-attenuationCoeff * depth);

  return color * attenuation;
}
// ====================== 以上：水体颜色 ======================

// ====================== 以下：水体透明度 ======================
/**
 * === 透明度 ===
 *
 * 水体的透明度受多个因素影响：
 * 1. 深度：深水区更不透明
 * 2. 泡沫：泡沫区域完全不透明
 * 3. 角度：掠射角时反射增强，透明度降低
 */
// 基于深度的透明度计算
float calculateDepthTransparency(float depth, vec3 attenuationCoeff) {
  // RGB通道的不同衰减率（蓝光衰减最慢）
  vec3 attenuation = exp(-attenuationCoeff * depth);

  // 综合透明度（考虑视觉感知）
  float transparency = dot(attenuation, vec3(0.299, 0.587, 0.114));

  return clamp(transparency, 0.0, 1.0);
}
float calculateWaterAlpha(float foam, float depth, float NdotV) {
  // === 基础透明度（基于深度）===
  float baseAlpha = mix(0.8, 0.95, clamp(depth * 0.08, 0.0, 1.0));

  // === 菲涅尔透明度调制 ===
  // 掠射角时水体更不透明（更多反射）
  float fresnelAlpha = mix(0.1, 0.0, pow(1.0 - NdotV, 3.0));

  // === 泡沫区域不透明 ===
  float finalAlpha = mix(baseAlpha + fresnelAlpha, 1.0, foam);

  return clamp(finalAlpha, 0.0, 1.0);
}
// ====================== 以上：水体透明度 ======================

// ====================== 以下：折射计算   ======================
/**
 * === 简化的折射偏移 ===
 *
 * 计算水面折射引起的视觉偏移
 * 这里使用简化的近似，实际应用中可以用屏幕空间折射
 */
vec2 calculateRefractionOffset(vec3 normal, vec3 viewDir, float strength) {
  // 基于法线和视角的简化折射偏移
  vec2 offset = normal.xz * strength;

  // 根据视角调制偏移强度
  float NdotV = max(dot(normal, viewDir), 0.0);
  // offset *= 1.0 - NdotV * 0.5;
  float fresnelTerm = pow(1.0 - NdotV, 2.0);

  // 折射在掠射角时减弱（更多反射）
  offset *= 1.0 - fresnelTerm * 0.8;

  return offset;
}
/**
 * 计算折射向量
 * @param incident 入射方向向量（指向表面）
 * @param normal 表面法向量
 * @param eta 相对折射率 (n1/n2)
 * @return 折射方向向量，如果全内反射则返回零向量
 */
vec3 calculateRefraction(vec3 incident, vec3 normal, float eta) {
  float cosI = -dot(normal, incident);
  float sinT2 = eta * eta * (1.0 - cosI * cosI);

  // 检查全内反射
  if (sinT2 > 1.0) {
    return vec3(0.0); // 全内反射
  }

  float cosT = sqrt(1.0 - sinT2);
  return eta * incident + (eta * cosI - cosT) * normal;
}
/**
 * 计算折射颜色（简化的屏幕空间方法）
 */
vec3 calculateRefractedColor(
  vec2 screenCoord,
  vec3 normal,
  vec3 viewDir,
  sampler2D sceneTexture,
  float refractionStrength
) {
  // 计算折射偏移
  vec2 refractionOffset = calculateRefractionOffset(normal, viewDir, refractionStrength);

  // 采样折射后的场景颜色
  vec2 refractionCoord = screenCoord + refractionOffset;
  refractionCoord = clamp(refractionCoord, 0.0, 1.0);

  vec3 refractedColor = texture2D(sceneTexture, refractionCoord).rgb;

  // 应用水体颜色调制
  vec3 waterTint = vec3(0.8, 0.9, 1.0);
  return refractedColor * waterTint;
}
// ====================== 以上：折射计算   ======================

// ====================== 以下：次表面散射   ======================
/**
 * 计算次表面散射
 */
vec3 calculateSubsurfaceScattering(vec3 lightDir, vec3 viewDir, vec3 normal, vec3 thickness, vec3 scatterColor) {
  vec3 lightDirWS = lightDir + normal * 0.25;
  float VdotL = pow(clamp(dot(viewDir, -lightDirWS), 0.0, 1.0), 4.0);
  return scatterColor * VdotL * thickness;
}
/**
 * 透光性次表面散射近似
 */
vec3 calculateTranslucency(vec3 normal, vec3 lightDir, vec3 viewDir, vec3 thickness, vec3 scatterColor, float power) {
  // 计算透射光方向
  vec3 lightDirWS = lightDir + normal * 0.25;

  // 视线与透射光的夹角
  float VdotL = pow(clamp(dot(viewDir, -lightDirWS), 0.0, 1.0), power);

  // 厚度调制
  float distortion = 0.1;
  vec3 H = normalize(lightDir + normal * distortion);
  float VdotH = pow(clamp(dot(viewDir, -H), 0.0, 1.0), power);

  // 组合透光效果
  return scatterColor * (VdotL + VdotH) * thickness;
}
/**
 * 基于深度的次表面散射
 */
vec3 calculateDepthBasedSSS(vec3 worldPos, vec3 normal, vec3 lightDir, vec3 viewDir, float depth) {
  // 散射颜色（偏向蓝绿色）
  vec3 scatterColor = vec3(0.2, 0.6, 0.8);

  // 深度相关的散射强度
  float scatterStrength = exp(-depth * 0.15);

  // 计算散射方向
  vec3 scatterDir = normalize(lightDir + normal * 0.3);
  float scatterDot = pow(clamp(dot(viewDir, -scatterDir), 0.0, 1.0), 3.0);

  // 基于法线的侧向散射
  float sideLighting = pow(clamp(1.0 - abs(dot(normal, viewDir)), 0.0, 1.0), 2.0);

  return scatterColor * (scatterDot + sideLighting * 0.5) * scatterStrength;
}

/**
 * 水体散射颜色的物理计算
 */
vec3 calculatePhysicalScatterColor(float depth, float turbidity, vec3 lightColor) {
  // === 水分子的Rayleigh散射 ===
  // 蓝光散射最强，红光散射最弱（∝ 1/λ⁴）
  vec3 rayleighCoeff = vec3(
    0.1, // 红光 (700nm)
    0.3, // 绿光 (550nm)
    0.8 // 蓝光 (450nm)
  );

  // === 悬浮颗粒的Mie散射 ===
  // 对所有波长影响相近
  float mieCoeff = turbidity * 0.5;
  vec3 mieScatter = vec3(mieCoeff);

  // === 叶绿素吸收 ===
  // 主要吸收红光和蓝光，透射绿光
  vec3 chlorophyllAbsorption = vec3(0.7, 0.2, 0.6) * turbidity;

  // === 综合散射颜色 ===
  vec3 totalScattering = rayleighCoeff + mieScatter - chlorophyllAbsorption;

  // 深度衰减
  vec3 depthAttenuation = exp(-totalScattering * depth * 0.1);

  // 与入射光颜色结合
  return lightColor * totalScattering * depthAttenuation;
}

/**
 * 不同水体类型的散射颜色
 */
vec3 getWaterTypeScatterColor(int waterType, float depth) {
  vec3 scatterColor;

  if (waterType == 0) {
    scatterColor = vec3(0.05, 0.3, 0.8);
  } else if (waterType == 1) {
    scatterColor = vec3(0.1, 0.5, 0.9);
  } else if (waterType == 2) {
    scatterColor = vec3(0.15, 0.4, 0.6);
  } else if (waterType == 3) {
    scatterColor = vec3(0.3, 0.4, 0.4);
  } else if (waterType == 4) {
    scatterColor = vec3(0.2, 0.3, 0.2);
  } else {
    scatterColor = vec3(0.1, 0.4, 0.7); // 默认蓝色
  }

  // 深度调制
  float depthFactor = clamp(depth * 0.05, 0.0, 1.0);
  return mix(scatterColor * 1.2, scatterColor * 0.6, depthFactor);
}
/**
 * 基于物理的次表面散射
 */
vec3 calculatePhysicalSSS(
  vec3 worldPos,
  vec3 normal,
  vec3 lightDir,
  vec3 viewDir,
  float waterDepth,
  vec3 lightColor,
  int waterType
) {
  // === 1. 计算散射颜色 ===
  vec3 scatterColor = getWaterTypeScatterColor(waterType, waterDepth);

  // 如果有环境参数，可以进一步调制
  // scatterColor = calculatePhysicalScatterColor(waterDepth, uTurbidity, lightColor);

  // === 2. 计算厚度 ===
  // 基于深度和角度的厚度估算
  float NdotV = max(dot(normal, viewDir), 0.0);
  float apparentThickness = waterDepth / (NdotV + 0.1); // 避免除零
  vec3 thickness = vec3(exp(-apparentThickness * 0.08));

  // === 3. 多种散射效果组合 ===

  // 直接光散射
  vec3 directSSS = calculateTranslucency(normal, lightDir, viewDir, thickness, scatterColor, 4.0);

  // 环境光散射
  vec3 ambientScatterColor = scatterColor * 0.5;
  vec3 ambientSSS = calculateDepthBasedSSS(worldPos, normal, lightDir, viewDir, waterDepth) * ambientScatterColor;

  // 侧向散射（边缘光效应）
  float rimLighting = pow(1.0 - NdotV, 2.0);
  vec3 rimSSS = scatterColor * rimLighting * thickness * 0.3;

  // === 4. 时间动态变化 ===
  float timeVariation = sin(uTime * 0.3 + worldPos.x * 0.05) * 0.1 + 0.9;

  return (directSSS + ambientSSS + rimSSS) * timeVariation;
}

/**
 * 针对不同光源的散射计算
 */
vec3 calculateMultiLightSSS(vec3 worldPos, vec3 normal, vec3 viewDir, float waterDepth) {
  vec3 totalSSS = vec3(0.0);

  // === 主光源散射（太阳光）===
  // if (uLightColor.r > 0.0 || uLightColor.g > 0.0 || uLightColor.b > 0.0) {
  //   vec3 sunSSS = calculatePhysicalSSS(
  //     worldPos,
  //     normal,
  //     uLightDir,
  //     viewDir,
  //     waterDepth,
  //     uLightColor,
  //     0 // 假设是海水
  //   );
  //   totalSSS += sunSSS;
  // }

  // === 环境光散射（天空光）===
  vec3 reflectDir = reflect(-viewDir, normal);
  // vec3 skyColor = vec3(0.4, 0.6, 0.9); // 可以从skybox采样
  vec3 skyColor = textureCube(uEnvironmentMap, reflectDir).rgb;
  vec3 skySSS =
    calculatePhysicalSSS(worldPos, normal, vec3(0.0, 1.0, 0.0), viewDir, waterDepth, skyColor * 0.3, 0) * 0.5;
  totalSSS += skySSS;

  // === 底部反射光散射 ===
  if (waterDepth < 5.0) {
    // 只在浅水区考虑
    vec3 bottomColor = vec3(0.8, 0.7, 0.5); // 沙底颜色
    vec3 bottomSSS =
      calculatePhysicalSSS(worldPos, normal, vec3(0.0, -1.0, 0.0), viewDir, waterDepth, bottomColor * 0.2, 0) *
      (1.0 - waterDepth * 0.2);
    totalSSS += bottomSSS;
  }

  return totalSSS;
}
// ====================== 以上：次表面散射   ======================

// ====================== 以下：直接光照计算   ======================
// 计算直接光照的 Diffuse 部分
vec3 calculateDirectDiffuse(
  vec3 albedo,
  float metallic,
  vec3 normal,
  vec3 viewDir,
  vec3 lightDir,
  float fresnelPower,
  vec3 thickness,
  vec3 scatterColor
) {
  vec3 baseDiffuse = CookTorranceDiffuseBRDF(albedo, metallic, normal, viewDir, lightDir, fresnelPower);
  vec3 subsurface = calculateSubsurfaceScattering(lightDir, viewDir, normal, thickness, scatterColor);

  vec3 directDiffuse = baseDiffuse + subsurface;

  return directDiffuse;
}
// ====================== 以上：直接光照计算   ======================

// ====================== 以下：环境光计算 ======================
/**
 * 环境光采样
 */
vec3 sampleEnvironment(vec3 reflectDir) {
  vec3 envReflect = textureCube(uEnvironmentMap, reflectDir).rgb;
  envReflect = pow(envReflect, vec3(1.0 / 2.2));
  return envReflect;
}
vec3 sampleEnvironment(vec3 reflectDir, float roughness) {
  // 根据粗糙度选择mipmap level
  float mipLevel = roughness * 8.0; // 假设8级mipmap
  return textureCube(uEnvironmentMap, reflectDir, mipLevel).rgb;
}

/**
 * 计算环境光 Diffuse 部分
 */
vec3 calculateEnvDiffuse(vec3 albedo, vec3 normal, vec3 lightDir, vec3 viewDir, float depth, float metallic) {
  vec3 F0 = vec3(0.02);
  F0 = mix(F0, albedo, metallic);
  float NdotV = max(dot(normal, viewDir), 0.0);
  vec3 F = fresnelSchlick(NdotV, F0, 5.0);
  vec3 kd = (vec3(1.0) - F) * (1.0 - metallic);

  vec3 radiance = vec3(0.0, 0.0, 0.0);

  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(up, normal));
  up = normalize(cross(normal, right));

  // 不能直接用 phi += 0.25 和 theta += 0.25，会报错：Loop index cannot be modified by non-constant expression
  // float delta = 0.5;
  float sampleCounts = 0.0;
  // Σᵢ Σⱼ f(θᵢ,φⱼ) sin(θᵢ) × Δθ × Δφ, Δθ = π/(2×n2), Δφ = 2π/n1
  //  = Σᵢⱼ f(θᵢ,φⱼ) sin(θᵢ) × (π/2n2) × (2π/n1)
  //  = (π²/n1n2) × Σᵢⱼ f(θᵢ,φⱼ) sin(θᵢ)
  //  = (π²/sampleCounts) × Σᵢⱼ f(θᵢ,φⱼ) sin(θᵢ)
  for (float phi = 0.0; phi < 2.0 * M_PI; phi += 1.0) {
    for (float theta = 0.0; theta < M_PI / 2.0; theta += 1.0) {
      // 球坐标 -> 笛卡尔坐标（正切空间）
      // z 轴向上，θ 是与 z 轴的夹角，φ 是与 x 轴的夹角
      vec3 tangentSample = vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
      // 正切空间 -> 世界坐标  基变换：从"标准坐标系"到"世界坐标系"
      // localSample.x * right：局部X轴方向的贡献
      // localSample.y * up：   局部Y轴方向的贡献
      // localSample.z * normal：局部Z轴方向的贡献
      vec3 sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * normal;

      radiance += textureCube(uEnvironmentMap, sampleVec).rgb * cos(theta) * sin(theta);

      sampleCounts++;
    }
  }

  // sampleCounts = n1 * n2
  radiance = M_PI * M_PI * radiance * (1.0 / sampleCounts);

  vec3 envDiffuse = kd * albedo / M_PI * radiance;

  return envDiffuse * 0.3;
}

/**
 * 计算环境光 Specular 部分
 */
vec3 calculateEnvSpecular(vec3 albedo, vec3 normal, vec3 viewDir, float reflectance, float metallic, float roughness) {
  vec3 F0 = vec3(0.02);
  F0 = mix(F0, albedo, metallic);
  float NdotV = max(dot(normal, viewDir), 0.0);
  vec3 reflectDir = reflect(-viewDir, normal);

  vec3 envColor = sampleEnvironment(reflectDir, roughness);
  // vec3 envFresnel = fresnelSchlick(NdotV, F0, 5.0);
  vec3 envFresnel = fresnelSchlickRoughness(NdotV, F0, roughness);
  vec3 envSpecular = envColor * envFresnel * reflectance;

  return envSpecular;
}
// ====================== 以上：环境光计算 ======================

// ====================== 以下：法线计算 ======================
vec3 generateDetailWaterNormal(vec2 worldPos, float time, float detailScale, float detailStrength) {
  // 高频细节噪声（模拟风吹产生的小波纹）
  vec2 detailUV1 = worldPos * detailScale + time * vec2(0.05, 0.08);
  vec2 detailUV2 = worldPos * detailScale * 2.1 + time * vec2(-0.07, 0.06);

  // 使用更细致的噪声函数
  float detail1 = sin(detailUV1.x * 25.0) * cos(detailUV1.y * 20.0) * 0.4;
  float detail2 = cos(detailUV2.x * 35.0) * sin(detailUV2.y * 30.0) * 0.3;
  float detail3 = sin((detailUV1.x + detailUV1.y) * 40.0) * 0.3;

  float totalDetail = detail1 + detail2 + detail3;

  // 计算细节法线的梯度
  float epsilon = 0.001;
  float dDetailDx =
    totalDetail -
    (sin((detailUV1.x + epsilon) * 25.0) * cos(detailUV1.y * 20.0) * 0.4 +
      cos((detailUV2.x + epsilon) * 35.0) * sin(detailUV2.y * 30.0) * 0.3 +
      sin((detailUV1.x + epsilon + detailUV1.y) * 40.0) * 0.3);

  float dDetailDy =
    totalDetail -
    (sin(detailUV1.x * 25.0) * cos((detailUV1.y + epsilon) * 20.0) * 0.4 +
      cos(detailUV2.x * 35.0) * sin((detailUV2.y + epsilon) * 30.0) * 0.3 +
      sin((detailUV1.x + (detailUV1.y + epsilon)) * 40.0) * 0.3);

  // 构造切线空间的细节法线
  return normalize(vec3(-dDetailDx * detailStrength, 1.0, -dDetailDy * detailStrength));
}
/**
 * 法线混合方法（考虑物理正确性）
 */
vec3 blendGerstnerWithDetail(vec3 gerstnerNormal, vec3 detailNormal, float detailWeight) {
  // 方法1：Reoriented Normal Mapping（推荐）
  vec3 t = gerstnerNormal * vec3(2.0, 2.0, 2.0) + vec3(-1.0, -1.0, 0.0);
  vec3 u = detailNormal * vec3(-2.0, -2.0, 2.0) + vec3(1.0, 1.0, -1.0);
  vec3 blended = t * dot(t, u) / t.z - u;

  return normalize(mix(gerstnerNormal, blended, detailWeight));
}
/**
 * 完整的水面法线计算流程
 */
vec3 calculateCompleteWaterNormal(vec3 normal, vec2 worldPos, float time) {
  // 主法线
  vec3 mainNormal = normal;

  // 生成细节法线
  vec3 detailNormal = generateDetailWaterNormal(worldPos, time, 0.1, 0.2);

  // 混合主法线和细节法线
  vec3 finalNormal = blendGerstnerWithDetail(mainNormal, detailNormal, 0.3);

  return finalNormal;
}
// ====================== 以上：法线计算 ======================

// ====================== 以下：泡沫计算 ======================
/**
 * === 物理正确的泡沫计算 ===
 *
 * 泡沫生成的物理条件：
 * 1. 波浪陡峭度过高（雅可比行列式 < 阈值）
 * 2. 波峰处的速度梯度大
 * 3. 气泡夹带和破碎波
 */
/**
 * 基于波浪陡峭度的泡沫计算
 */
float calculateSteepnessFoam(vec3 normal, float steepnessThreshold) {
  // 法线偏离垂直方向的程度
  float steepness = 1.0 - normal.y;

  // 非线性映射，突出陡峭区域
  steepness = pow(steepness, 2.0);

  // 阈值化处理
  return smoothstep(steepnessThreshold, steepnessThreshold + 0.2, steepness);
}
/**
 * 基于雅可比行列式的泡沫
 */
float calculateJacobianFoam(vec2 position, float time, float jacobian) {
  // 当雅可比行列式接近或小于0时产生泡沫
  float foamAmount = 1.0 - clamp(jacobian, 0.0, 1.0);
  foamAmount = pow(foamAmount, 0.5); // 软化边缘

  return foamAmount;
}

float calculateFoam(vec3 normal, float waveHeight, vec2 worldPos, float time) {
  // === 基于坡度的泡沫（法线偏离程度） ===
  float steepness = 1.0 - normal.y; // normal.y越小，坡度越陡
  steepness = smoothstep(0.3, 0.8, steepness);

  // === 基于波高的泡沫 ===
  float heightFoam = smoothstep(0.15, 0.6, abs(waveHeight * 0.3));

  // === 时间变化的噪声纹理（模拟泡沫的动态性） ===
  vec2 foamUV1 = worldPos * 0.2 + time * 0.08;
  vec2 foamUV2 = worldPos * 0.35 + time * 0.12;

  // 多层噪声叠加
  float foamNoise1 = sin(foamUV1.x * 12.0) * sin(foamUV1.y * 10.0) * 0.5 + 0.5;
  float foamNoise2 = cos(foamUV2.x * 18.0 + time * 0.4) * cos(foamUV2.y * 15.0) * 0.5 + 0.5;
  float foamNoise = mix(foamNoise1, foamNoise2, 0.6);

  // 噪声阈值化，产生泡沫斑块
  foamNoise = smoothstep(0.35, 0.75, foamNoise);

  // 综合泡沫强度
  return max(steepness * 0.7, heightFoam * 0.5) * foamNoise;
}
// ====================== 以上：泡沫计算 ======================

void main() {
  // 时间
  float time = uTime;

  // 归一化法线
  vec3 normal = normalize(vNormal);
  // normal = calculateCompleteWaterNormal(normal, vWorldPosition.xz, time);

  // 计算视线方向
  vec3 viewDir = normalize(uCameraPos - vWorldPosition);

  // 计算光照方向
  vec3 lightDir = normalize(uLightDir); // 外部已经计算好（反向）太阳光（平行光）的方向了

  // =============== 水体颜色计算 ===============
  // 水体颜色计算
  // vec3 waterColor = calculateDepthColor(uWaterColor, depth);
  vec3 waterColor = calculateDepthColor(uWaterColor, vWaterDepth);
  // 颜色衰减
  vec3 attenuatedColor = applyWaterColorAttenuation(waterColor, vWaterDepth);

  // =============== 折射效果计算 ===============
  vec2 refractionOffset = calculateRefractionOffset(normal, viewDir, 0.05);
  vec3 refractedColor = vec3(0.0);

  // 如果有场景纹理，计算折射颜色
  // refractedColor = calculateRefractedColor(screenCoord, normal, viewDir, uSceneTexture, 0.05);

  // =============== 次表面散射计算 ===============
  // 方法1：使用多光源散射
  vec3 multiLightSSS = calculateMultiLightSSS(vWorldPosition, normal, viewDir, vWaterDepth);

  // 方法2：使用物理散射（如果性能允许）
  vec3 physicalSSS = calculatePhysicalSSS(
    vWorldPosition,
    normal,
    lightDir,
    viewDir,
    vWaterDepth,
    uLightColor,
    0 // 水体类型可以作为uniform
  );

  // 根据需要选择使用哪种方法
  vec3 finalSSS = multiLightSSS; // 或者 physicalSSS

  // =============== 泡沫计算 ===============
  // float foam = calculateFoam(normal, vWaveHeight, vWorldPosition.xz, time);
  float foam = calculateJacobianFoam(vWorldPosition.xz, time, vJacobian);
  vec3 albedo = mix(waterColor, vec3(1.0), foam * 0.05);

  // 设置金属度
  float metallic = 0.02;
  // 设置粗糙度
  float roughness = 0.1;
  // 动态粗糙度（基于波浪和泡沫）
  float dynamicRoughness = WATER_BASE_ROUGHNESS + abs(vWaveHeight) * 0.02 + foam * 0.1;

  // 计算直接光照 Radiance
  float NdotL = max(dot(normal, lightDir), 0.0);
  vec3 directDiffuse = calculateDirectDiffuse(
    albedo,
    metallic,
    normal,
    viewDir,
    lightDir,
    0.5,
    vec3(1.0, 0.8, 0.6),
    vec3(0.1, 0.4, 0.7)
  );
  vec3 directSpecular = CookTorranceSpecularBRDF(albedo, dynamicRoughness, metallic, normal, viewDir, lightDir, 5.0);
  vec3 directBRDF = directDiffuse + directSpecular;
  vec3 directRadiance = directBRDF * uLightColor * NdotL;

  // 计算环境光照 Radiance
  vec3 envRadiance = vec3(0.0);
  vec3 envDiffuse = calculateEnvDiffuse(albedo, normal, lightDir, viewDir, 0.0, metallic);
  vec3 envSpecular = calculateEnvSpecular(albedo, normal, viewDir, uReflectance, metallic, dynamicRoughness);
  envRadiance = envDiffuse + envSpecular;

  // 计算直接光照 + 环境光照
  vec3 radiance = directRadiance + envRadiance + finalSSS;

  // 透明度计算
  float NdotV = max(dot(normal, viewDir), 0.0);
  float alpha = calculateWaterAlpha(foam, vWaterDepth, NdotV);

  // 一定不要忘记做 Gamma 校正
  radiance = pow(clamp(radiance, 0.0, 1.0), vec3(1.0 / 2.2));

  gl_FragColor = vec4(radiance, alpha);
  // gl_FragColor = vec4(normal, 1.0);
  // gl_FragColor = vec4(finalSSS, 1.0);
  // gl_FragColor = vec4(vec3(vJacobian), 1.0);
}
