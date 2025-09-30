// FFTOceanFragment.glsl
#ifdef GL_ES
precision highp float;
#endif

// 从 Vertex shader 传入的 Fragment varying
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vTexCoord;
varying float vFoam; // 传递泡沫因子（雅可比值）
varying float vWaterDepth;
varying float vWaveHeight;

uniform vec3 uCameraPos;
// 光照参数
uniform vec3 uLightColor;
uniform vec3 uLightPos;
uniform vec3 uLightDir;

// 水体颜色参数
uniform vec3 uWaterColor;
uniform vec3 uDeepWaterColor;
uniform vec3 uShallowWaterColor;

// 水体物理参数
uniform float uTransparency;
uniform float uReflectance;
uniform float uRefractiveIndex;
uniform float uFresnelPower;
uniform float uSpecularPower;
uniform float uSpecularStrength;
uniform float uFoamThreshold;

// 波浪控制参数
// uniform float uTime;

// Textures
uniform sampler2D uDiffuseMap;
uniform sampler2D uNormalMap;
uniform samplerCube uEnvironmentMap;
uniform int uUseDiffuseMap;
uniform int uUseNormalMap;
uniform int uUseEnvironmentMap;

uniform sampler2D uDisplacementMap; // IFFT 生成的位移贴图
uniform sampler2D uGradientMap; // IFFT 生成的梯度贴图
uniform sampler2D uDispDerivativeMap; // IFFT 生成的位移导数贴图

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
#define TWO_PI 6.28318530717958623199592693708837
#define INV_PI 0.31830988618379067154
#define INV_TWO_PI 0.1591549430918953456082

// ==================== 结构化材质属性和所占比重 ====================
/**
 * 水的材质属性：描述水这种物质的固有光学特性
 */
struct WaterProperties {
  vec3 baseColor; // 水的基础颜色
  float ambientFactor; // 对环境光的反射效率 (0-1)
  float diffuseFactor; // 对直接光的漫反射效率 (0-1)
  float specularFactor; // 镜面反射强度 (0-1)
  float shininess; // 光泽度（影响高光尺寸）
  float subsurfaceFactor; // 次表面散射强度 (0-2)
};

/**
 * 光照强度：描述当前光照和观察条件下各种光照的实际强度
 */
struct LightingIntensities {
  float ambient; // 环境光可见度
  float diffuse; // 漫反射强度（基于Lambert定律）
  float specular; // 镜面反射强度（基于Blinn-Phong）
  float subsurface; // 次表面散射强度
  float fresnel; // 菲涅尔反射强度
};

// ==================== Water Color ====================
// 基于深度的颜色混合
// vec3 calculateDepthColor(vec3 shallowWaterColor, vec3 deepWaterColor, float depth) {
//   // 指数衰减：模拟光在水中的衰减
//   float depthFactor = 1.0 - exp(-depth * 0.1);

//   return mix(shallowWaterColor, deepWaterColor, depthFactor);
// }

// 考虑不同波长的衰减（红光衰减最快）
// vec3 applyWaterColorAttenuation(vec3 color, float depth) {
//   vec3 attenuationCoeff = vec3(0.3, 0.1, 0.05); // RGB衰减系数
//   vec3 attenuation = exp(-attenuationCoeff * depth);
//   return color * attenuation;
// }

WaterProperties getWaterProperties(int waterType, float turbidity) {
  WaterProperties props;

  // 根据水体类型设置基础颜色
  if (waterType == 0) {
    // 深海
    props.baseColor = vec3(0.0, 0.15, 0.4);
  } else if (waterType == 1) {
    // 浅海
    props.baseColor = vec3(0.0, 0.25, 0.5);
  } else if (waterType == 2) {
    // 湖泊
    props.baseColor = vec3(0.0, 0.2, 0.45);
  } else {
    // 河流/浑浊水
    props.baseColor = vec3(0.1, 0.2, 0.3);
  }

  // 浑浊度影响：浑浊水更偏绿黄色
  vec3 turbidityTint = vec3(0.3, 0.4, 0.2);
  props.baseColor = mix(props.baseColor, turbidityTint, turbidity);

  // 设置光学特性
  props.ambientFactor = 0.3; // 水对环境光的反射效率较低
  props.diffuseFactor = 0.4; // 水的漫反射效率中等
  props.specularFactor = mix(1.0, 0.6, turbidity); // 浑浊度降低镜面反射
  props.shininess = mix(64.0, 32.0, turbidity); // 浑浊度降低光泽度
  props.subsurfaceFactor = mix(1.2, 0.8, turbidity); // 浑浊度影响次表面散射

  return props;
}

// ==================== PBR 材质参数 ====================
struct PBRMaterial {
  vec3 albedo; // 基础颜色 (反射率)
  float metallic; // 金属度 [0,1]
  float roughness; // 粗糙度 [0,1]
  float ao; // 环境光遮蔽 [0,1]
  vec3 normal; // 表面法线
  vec3 emission; // 自发光
};

// ==================== Fresnel ====================
// Schlick近似（更快，略不精确）
// float fresnelSchlick(float cosTheta, float waterIOR, float airIOR) {
//   // 水的F0值
//   float F0 = pow((airIOR - waterIOR) / (airIOR + waterIOR), 2.0); // ≈ 0.02
//   return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
// }
// Schlick 近似
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

float calculateFresnelReflectivityAlgebraic(vec3 normal, vec3 viewDir, float waterIOR, float airIOR) {
  float reflectivity = 0.0;
  // costhetai = max(dot(nI, nN),0.0); // 入射角余弦值，nI - 入射方向向量，nN - 表面法向量
  float costhetai = max(dot(viewDir, normal), 0.0);
  float sinthetai = sqrt(1.0 - costhetai * costhetai);
  // 折射角正弦（斯涅尔定律）
  float sinthetat = airIOR * sinthetai / waterIOR;
  float costhetat = sqrt(1.0 - sinthetat * sinthetat);

  float n1 = airIOR; // 1.0
  float n2 = waterIOR; // 1.33

  if (sinthetat > 1.0) {
    // 全反射情况
    reflectivity = 1.0;
  } else {
    // 一般情况：完整的菲涅尔公式
    float fs = (n1 * costhetai - n2 * costhetat) / (n1 * costhetai + n2 * costhetat);
    float ts = (n2 * costhetai - n1 * costhetat) / (n2 * costhetai + n1 * costhetat);
    reflectivity = 0.5 * (fs * fs + ts * ts);
  }

  return reflectivity;
}

// float calculateFresnelReflectivityTrigonometric(vec3 normal, vec3 viewDir, float waterIOR, float airIOR) {
//   float reflectivity = 0.0;
//   // costhetai = max(dot(nI, nN),0.0); // 入射角余弦值，nI - 入射方向向量，nN - 表面法向量
//   float costhetai = max(dot(viewDir, normal), 0.0);

//   float thetai = acos(costhetai); // 入射角
//   float sinthetat = airIOR * sin(thetai) / waterIOR; // 折射角正弦（斯涅尔定律）
//   float thetat = asin(sinthetat); // 折射角

//   if (sinthetat > 1.0) {
//     // 全反射情况
//     reflectivity = 1.0;
//   } else if (thetai == 0.0) {
//     // 垂直入射的特殊情况
//     reflectivity = (waterIOR - 1.0) / (waterIOR + 1.0);
//     reflectivity = reflectivity * reflectivity;
//   } else {
//     // 一般情况：完整的菲涅尔公式
//     float fs = sin(thetat - thetai) / sin(thetat + thetai);
//     float ts = tan(thetat - thetai) / tan(thetat + thetai);
//     reflectivity = 0.5 * (fs * fs + ts * ts);
//   }

//   return reflectivity;
// }

// 考虑粗糙度的菲涅尔反射 (用于IBL)
vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {
  return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(1.0 - cosTheta, 5.0);
}

float calculateRealisticFresnel(vec3 normal, vec3 viewDir, float roughness) {
  float cosTheta = max(dot(normal, viewDir), 0.0);

  // 基础菲涅尔反射率（水的F0约为0.02）
  float F0 = 0.02;

  // Schlick近似，但添加粗糙度修正
  float fresnel = F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);

  // 关键：确保fresnel值在合理范围内
  fresnel = clamp(fresnel, 0.0, 0.6); // 限制最大值为0.8

  // 粗糙表面会降低反射强度
  fresnel *= mix(1.0, 0.3, roughness);

  // 限制最大反射强度，真实水面很少达到100%反射
  // fresnel = min(fresnel, 0.8);

  return fresnel;
}

// ==================== Normal Distribution Function ====================
// Trowbridge-Reitz GGX/GTR2
float distributionGGX(vec3 N, vec3 H, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float NdotH = max(dot(N, H), 0.0);
  float NdotH2 = NdotH * NdotH;

  float nom = a2;
  float denom = NdotH2 * (a2 - 1.0) + 1.0;
  denom = M_PI * denom * denom;

  return nom / denom;
}

// ==================== 几何衰减函数 (Geometry Function) ====================
// Smith's method
float geometrySchlickGGX(float NdotV, float roughness) {
  float r = roughness + 1.0;
  float k = r * r / 8.0;

  float nom = NdotV;
  float denom = NdotV * (1.0 - k) + k;

  return nom / denom;
}

float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
  float NdotV = max(dot(N, V), 0.0);
  float NdotL = max(dot(N, L), 0.0);
  float ggx2 = geometrySchlickGGX(NdotV, roughness);
  float ggx1 = geometrySchlickGGX(NdotL, roughness);

  return ggx1 * ggx2;
}

// ==================== 色调映射 ====================
// ACES 色调映射
vec3 ACESToneMapping(vec3 color) {
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;

  return clamp(color * (a * color + b) / (color * (c * color + d) + e), 0.0, 1.0);
}

// ==================== PBR 直接光照计算 ====================
vec3 calculateDirectLighting(PBRMaterial material, vec3 V, vec3 L, vec3 lightColor) {
  vec3 N = material.normal;
  vec3 H = normalize(V + L);

  // 光照向量
  float NdotV = max(dot(N, V), 0.0);
  float NdotL = max(dot(N, L), 0.0);
  float HdotV = max(dot(H, V), 0.0);

  // 计算基础反射率 F0
  // 对于非金属，F0约为0.04；对于金属，F0等于albedo
  vec3 F0 = vec3(0.04);
  F0 = mix(F0, material.albedo, material.metallic);

  // Cook-Torrance BRDF
  float NDF = distributionGGX(N, H, material.roughness);
  float G = geometrySmith(N, V, L, material.roughness);
  vec3 F = fresnelSchlick(HdotV, F0);

  // 计算镜面反射项
  vec3 numerator = NDF * G * F;
  float denominator = 4.0 * NdotV * NdotL + 0.001; // 防止除零
  vec3 specular = numerator / denominator;

  // kS 是镜面反射的能量比例
  vec3 kS = F;
  // kD 是漫反射的能量比例
  vec3 kD = vec3(1.0) - kS;

  // 金属没有漫反射
  kD *= 1.0 - material.metallic;

  // Lambert 漫反射
  vec3 diffuse = material.albedo / M_PI;

  // 最终的反射率方程
  vec3 Lo = (kD * diffuse + specular) * lightColor * NdotL;

  return Lo;
}

// ==================== IBL 环境光照 (简化版本) ====================
vec3 calculateIBL(PBRMaterial material, vec3 V, samplerCube environmentMap) {
  vec3 N = material.normal;
  vec3 R = reflect(-V, N);

  float NdotV = max(dot(N, V), 0.0);

  // 计算F0
  vec3 F0 = vec3(0.04);
  F0 = mix(F0, material.albedo, material.metallic);

  // 菲涅尔反射 (考虑粗糙度)
  vec3 F = fresnelSchlickRoughness(NdotV, F0, material.roughness);

  vec3 kS = F;
  vec3 kD = 1.0 - kS;
  kD *= 1.0 - material.metallic;

  // 漫反射IBL (使用环境贴图模拟)
  vec3 irradiance = textureCube(environmentMap, N).rgb;
  vec3 diffuse = irradiance * material.albedo;

  // 镜面反射IBL
  // 根据粗糙度调整采样的mip level
  float mipLevel = material.roughness * 7.0; // 假设环境贴图有8个mip层
  vec3 prefilteredColor = textureCube(environmentMap, R).rgb;

  // BRDF积分查找表 (这里用简化近似)
  float roughness2 = material.roughness * material.roughness;
  vec2 envBRDF = vec2(
    mix(1.0, 0.0, roughness2), // scale
    mix(0.0, 1.0, roughness2) // bias
  );

  vec3 specular = prefilteredColor * (F * envBRDF.x + envBRDF.y);

  // 组合漫反射和镜面反射
  vec3 ambient = (kD * diffuse + specular) * material.ao;

  return ambient;
}

// ==================== 主要的 PBR 着色函数 ====================
vec3 calculatePBRLighting(
  PBRMaterial material,
  vec3 worldPos,
  vec3 viewPos,
  vec3 lightDir,
  vec3 lightColor,
  samplerCube environmentMap
) {
  vec3 V = normalize(viewPos - worldPos);
  vec3 L = normalize(-lightDir); // 光线方向

  // 计算直接光照
  vec3 directLighting = calculateDirectLighting(material, V, L, lightColor);

  // 计算环境光照 (IBL)
  vec3 ambientLighting = calculateIBL(material, V, environmentMap);

  // 合成最终颜色
  vec3 color = directLighting + ambientLighting + material.emission;

  // 色调映射和伽马校正
  color = ACESToneMapping(color);
  color = pow(color, vec3(1.0 / 2.2)); // 伽马校正

  return color;
}

// ==================== Subsurface Scattering ====================
float sss_intensity(
  int status,
  vec3 lightDir,
  vec3 viewDir,
  vec3 normal,
  float distortion,
  float waveHeight,
  float SSSMask
) {
  if (status == 0) {
    return 0.0;
  }

  // 扭曲法线，模拟光在水中的散射路径
  vec3 h = normalize(viewDir + normal * distortion);

  // 计算散射强度：考虑观看角度和光照角度
  float intensity = pow(clamp(dot(h, -lightDir), 0.0, 1.0), 4.0) * pow(waveHeight, 1.0) * SSSMask;

  // 快速次表面散射近似
  if (status == 2) {
    h = normalize(lightDir + normal * distortion);
    intensity = pow(clamp(dot(viewDir, -h), 0.0, 1.0), 4.0) * pow(waveHeight, 1.0) * SSSMask;
    return intensity;
  }

  return intensity;
}

// ==================== Lighting Intensity ====================
LightingIntensities calculateLightingIntensities(
  vec3 normal,
  vec3 viewDir,
  vec3 lightDir,
  float waveHeight,
  float fresnelFactor,
  float shininess
) {
  LightingIntensities intensities;

  // 基础光照计算
  float NdotL = max(dot(normal, lightDir), 0.0);
  float NdotV = max(dot(normal, viewDir), 0.0);
  vec3 halfwayDir = normalize(lightDir + viewDir);
  float NdotH = max(dot(normal, halfwayDir), 0.0);

  // 1. 环境光强度：基本为常量
  intensities.ambient = 1.0;

  // 2. 漫反射强度：Lambert定律
  intensities.diffuse = NdotL;

  // 3. 镜面反射强度：Blinn-Phong模型，使用材质的shininess
  intensities.specular = pow(NdotH, shininess) * (1.0 + abs(waveHeight));

  // 4. 次表面散射强度：边缘光效应
  float rimLighting = pow(1.0 - NdotV, 2.0);
  float backLighting = pow(clamp(dot(viewDir, -lightDir), 0.0, 1.0), 3.0);
  intensities.subsurface = (rimLighting + backLighting) * 0.5;

  // 5. 菲涅尔强度
  intensities.fresnel = fresnelFactor;

  return intensities;
}

// ==================== Environment Reflection ====================
vec3 calculateEnvironmentReflection(vec3 normal, vec3 viewDir) {
  vec3 reflectDir = reflect(-viewDir, normal);

  if (uUseEnvironmentMap == 1) {
    return textureCube(uEnvironmentMap, reflectDir).rgb;
  } else {
    // 简单的天空颜色梯度
    float skyFactor = max(reflectDir.y, 0.0);
    return mix(vec3(0.1, 0.3, 0.5), vec3(0.7, 0.9, 1.0), skyFactor);
  }
}

// ==================== Foam ====================

// ==================== Perturb Normal ====================
vec3 perturbNormal(int perturbationMode) {
  vec2 texelSize = vec2(1.0) / vec2(128.0); // 根据您的分辨率调整

  vec2 gradient = vec2(0.0, 0.0);

  // 梯度采样时进行扰动，并选择使用哪个梯度
  if (perturbationMode == 0) {
    vec2 gradientCenter = texture2D(uGradientMap, vTexCoord).xy;
    gradient = gradientCenter;
  } else if (perturbationMode == 1) {
    vec2 gradientRight = texture2D(uGradientMap, vTexCoord + vec2(texelSize.x, 0.0)).xy;
    gradient = gradientRight;
  } else if (perturbationMode == 2) {
    vec2 gradientUp = texture2D(uGradientMap, vTexCoord + vec2(0.0, texelSize.y)).xy;
    gradient = gradientUp;
  }

  vec2 detailGradient = texture2D(uGradientMap, vTexCoord * 4.0).xy * 0.3;

  // 法线计算扰动（这里是关键）
  // vec3 normal = normalize(
  //   vec3(
  //     -gradient.x * 2.0, // X分量
  //     1.0, // Y分量（向上）
  //     -gradient.y * 2.0 // Z分量
  //   )
  // );

  vec3 normal = normalize(vec3(-(gradient.x + detailGradient.x), 1.0, -(gradient.y + detailGradient.y)));

  return normal;
}

// ==================== 改进的环境反射采样 ====================
vec3 calculateRealisticEnvironmentReflection(
  vec3 normal,
  vec3 viewDir,
  float roughness,
  samplerCube environmentMap,
  float distortionStrength
) {
  // 1. 计算基础反射方向
  vec3 reflectDir = reflect(-viewDir, normal);

  // 2. 添加基于粗糙度的扰动（模拟微表面散射）
  float mipLevel = roughness * 7.0; // 根据粗糙度选择mip层级

  // 3. 添加轻微的方向扰动（模拟波浪造成的反射扰动）
  vec2 distortion = normal.xz * distortionStrength;
  vec3 distortedReflectDir = normalize(reflectDir + vec3(distortion.x, 0.0, distortion.y) * 0.1);

  // 4. 采样环境贴图
  vec3 envColor = textureCube(environmentMap, distortedReflectDir).rgb;
  // 降低饱和度，让反射更自然
  float luminance = dot(envColor, vec3(0.299, 0.587, 0.114));
  envColor = mix(vec3(luminance), envColor, 0.6); // 降低饱和度
  // 进一步减弱反射强度
  envColor *= 0.8;

  // 5. 大气散射效果：远处的反射会偏蓝
  float skyFactor = max(distortedReflectDir.y, 0.0);
  vec3 atmosphericTint = mix(vec3(0.8, 0.9, 1.0), vec3(1.0), skyFactor);
  envColor *= atmosphericTint;

  // 6. 降低整体强度，真实水面不会完全反射天空
  envColor *= 0.6;

  return envColor;
}

// ==================== 水体颜色混合 ====================
vec3 calculateWaterBodyColor(vec3 baseWaterColor, float waterDepth, vec3 lightDir, vec3 viewDir, vec3 normal) {
  // 1. 深度影响的水体颜色
  vec3 shallowColor = vec3(0.2, 0.26, 0.36); // 更深的浅水色
  vec3 deepColor = vec3(0.0, 0.02, 0.03); // 更深的深水色
  float depthFactor = 1.0 - exp(-waterDepth * 0.1);
  vec3 waterColor = mix(shallowColor, deepColor, depthFactor);

  // 2. 简单的次表面散射
  vec3 H = normalize(viewDir + normal * 0.5); // 轻微扭曲的半角向量
  float sss = pow(max(dot(H, -lightDir), 0.0), 3.0) * 0.3;
  waterColor += vec3(0.0, 0.3, 0.1) * sss;

  return waterColor;
}

// ==================== 综合的水面着色 ====================
vec3 calculateRealisticWaterShading(
  vec3 worldPos,
  vec3 normal,
  vec3 viewPos,
  vec3 viewDir,
  vec3 lightDir,
  vec3 lightColor,
  samplerCube environmentMap,
  float waterDepth,
  float waveHeight
) {
  // 1. 计算表面粗糙度（基于波浪）
  float baseRoughness = 0.02; // 水的基础粗糙度
  float waveRoughness = abs(waveHeight) * 0.1; // 波浪增加粗糙度
  float totalRoughness = clamp(baseRoughness + waveRoughness, 0.01, 0.5);

  // 2. 计算真实的菲涅尔反射强度
  float fresnelStrength = calculateRealisticFresnel(normal, viewDir, totalRoughness);

  // 3. 计算水体本身的颜色
  vec3 waterBodyColor = calculateWaterBodyColor(vec3(0.0, 0.2, 0.4), waterDepth, lightDir, viewDir, normal);

  // 4. 计算环境反射
  vec3 environmentReflection = calculateRealisticEnvironmentReflection(
    normal,
    viewDir,
    totalRoughness,
    environmentMap,
    0.3 // 扰动强度
  );
  vec3 coolReflection = environmentReflection * vec3(0.8, 0.9, 1.1);

  // 5. 计算直接光照（简化的Lambert）
  float NdotL = max(dot(normal, lightDir), 0.0);
  vec3 directLighting = waterBodyColor * lightColor * NdotL * 0.5;

  // 6. 混合水体颜色和环境反射
  // 关键：不是简单的lerp，而是基于物理的混合
  // vec3 finalColor =
  //   waterBodyColor * (1.0 - fresnelStrength) + environmentReflection * fresnelStrength * 0.7 + directLighting;
  vec3 finalColor = waterBodyColor * (1.0 - fresnelStrength) + coolReflection * fresnelStrength * 0.3; // 降低反射强度

  // 7. 添加环境光（防止过暗）
  vec3 ambientColor = waterBodyColor * 0.5;
  finalColor += ambientColor;

  // 8. 距离衰减效果：远处更偏向水体本身颜色
  // float distanceFromCamera = length(worldPos - viewDir); // 简化
  // float distanceFactor = clamp(distanceFromCamera / 1000.0, 0.0, 1.0);
  // finalColor = mix(finalColor, waterBodyColor, distanceFactor * 0.3);
  // 距离越远，颜色越偏向深蓝和雾霾色
  float distanceFromCamera = length(worldPos - viewPos);
  float atmosphericFactor = 1.0 - exp(-distanceFromCamera * 0.0008);
  vec3 atmosphericColor = vec3(0.4, 0.6, 0.8); // 大气色调
  // finalColor = mix(finalColor, atmosphericColor, atmosphericFactor * 0.4);

  // 9. 泡沫颜色混合
  float foamFactor = clamp(vFoam, 0.0, 1.0);
  foamFactor = smoothstep(0.4, 0.8, foamFactor);
  vec3 foamColor = vec3(0.95, 0.95, 0.98);
  finalColor = mix(finalColor, foamColor, 1.0 - foamFactor);

  // 10. 在最终颜色计算前添加
  float viewAngle = dot(normal, viewDir);
  float edgeFactor = 1.0 - abs(viewAngle);
  // 边缘区域更偏向深色
  vec3 edgeColor = vec3(0.0, 0.05, 0.2);
  // finalColor = mix(finalColor, edgeColor, edgeFactor * 0.3);

  return finalColor;
}

// ==================== 在main()中的使用方法 ====================
// void main() {
//   // 直接在 Fragment Shader 中计算法线
//   vec2 gradient = texture2D(uGradientMap, vTexCoord).xy;
//   // gl_FragColor = vec4(gradient.x, gradient.y, 0.0, 1.0);
//   // gl_FragColor = vec4(gradient.x * 0.5 + 0.5, gradient.y * 0.5 + 0.5, 0.0, 1.0);
//   float dDx_dx = texture2D(uDispDerivativeMap, vTexCoord).x;
//   float dDz_dz = texture2D(uDispDerivativeMap, vTexCoord).y;
//   float dDx_dz = texture2D(uDispDerivativeMap, vTexCoord).z;
//   float dDz_dx = texture2D(uDispDerivativeMap, vTexCoord).w;
//   float jacobian = (1.0 + dDx_dx) * (1.0 + dDz_dz) - dDx_dz * dDz_dx;

//   // vec4 displacement = texture2D(uDisplacementMap, vTexCoord);
//   // gl_FragColor = vec4(displacement.xyz, 1.0);
//   // return;
//   // gl_FragColor = vec4(vec3(displacement.w, displacement.w, displacement.w), 1.0);
//   // return;
//   // 临时调试：完全禁用光照
//   // gl_FragColor = vec4(0.0, 0.3, 0.6, 1.0); // 纯蓝色
//   // return;
//   // gradient = vec2(gradient.x * 0.5 + 0.5, gradient.y * 0.5 + 0.5); // <== 做了平滑处理（从这里继续）
//   gradient = vec2(gradient.x / (1.0 + dDx_dx), gradient.y / (1.0 + dDz_dz));
//   // 增强法线强度
//   // vec3 N = normalize(vec3(-gradient.x * 2.0, 1.0, -gradient.y * 2.0));
//   // vec3 N = normalize(vec3(-gradient.x, 1.0, -gradient.y));
//   vec3 N = normalize(
//     vec3(
//       -gradient.x * (1.0 + dDz_dz) + gradient.y * dDz_dx,
//       jacobian, // 不是固定的 1.0
//       -gradient.y * (1.0 + dDx_dx) + gradient.x * dDx_dz
//     )
//   );
//   gl_FragColor = vec4(N * 0.5 + 0.5, 1.0);
//   // return;
//   // 获取基础数据
//   // vec3 N = normalize(vNormal);
//   vec3 V = normalize(uCameraPos - vWorldPosition);
//   vec3 L = normalize(uLightDir);

//   // 使用改进的水面着色
//   vec3 finalColor = calculateRealisticWaterShading(
//     vWorldPosition,
//     N,
//     uCameraPos,
//     V,
//     L,
//     uLightColor,
//     uEnvironmentMap,
//     vWaterDepth,
//     vWaveHeight
//   );

//   // Gamma 校正
//   finalColor = pow(finalColor, vec3(1.0 / 2.2)); // 从2.2改为2.0

//   // 整体提亮30%
//   finalColor *= 1.3;

//   gl_FragColor = vec4(finalColor, 1.0);

//   // 调试选项
//   // gl_FragColor = vec4(vec3(calculateRealisticFresnel(N, V, 0.1)), 1.0); // 查看菲涅尔
//   // gl_FragColor = vec4(calculateWaterBodyColor(vec3(0.0, 0.2, 0.4), vWaterDepth, L, V, N), 1.0); // 查看水体颜色

// }

// void main() {
//     // 基础向量
//   vec3 N = perturbNormal(2);
//     // 设置材质属性
//     PBRMaterial material;
//     material.albedo = vec3(0.02, 0.15, 0.4);     // 水的基础颜色
//     material.metallic = 0.0;                      // 水不是金属
//     material.roughness = mix(0.01, 0.3, 0.1); // 根据波浪调整粗糙度
//     material.ao = 1.0;                            // 无环境光遮蔽
//     material.normal = vNormal;      // 从波浪计算的法线
//     material.emission = vec3(0.0);                // 水无自发光

//     // 计算最终颜色
//     vec3 finalColor = calculatePBRLighting(
//         material,
//         vWorldPosition,
//         uCameraPos,
//         uLightDir,
//         uLightColor,
//         uEnvironmentMap
//     );

//     gl_FragColor = vec4(finalColor, 1.0);
// }

// void main() {
//   // 基础向量
//   vec3 N = perturbNormal(2);
//   // vec3 N = normalize(vNormal);
//   vec3 V = normalize(uCameraPos - vWorldPosition);
//   vec3 L = normalize(uLightDir);

//   // 获取水的材质属性
//   WaterProperties waterProps = getWaterProperties(0, 0.1);

//   // 计算菲涅尔反射率
//   float reflectivity = calculateFresnelReflectivityAlgebraic(N, V, WATER_IOR, AIR_IOR);

//   // 计算各种光照强度
//   LightingIntensities intensities = calculateLightingIntensities(
//     N,
//     V,
//     L,
//     vWaveHeight,
//     reflectivity,
//     waterProps.shininess
//   );

//   // ============ 最终光照计算 ============

//   // 1. 环境光贡献 = 光照强度 × 材质反射效率 × 光源颜色
//   vec3 ambientColor = vec3(0.1, 0.1, 0.1);
//   vec3 ambientContribution = intensities.ambient * (waterProps.baseColor * waterProps.ambientFactor) * ambientColor;

//   // 2. 漫反射贡献 = 光照强度 × 材质反射效率 × 光源颜色
//   vec3 diffuseContribution = intensities.diffuse * (waterProps.baseColor * waterProps.diffuseFactor) * uLightColor;

//   // 3. 镜面反射贡献 = 光照强度 × 材质反射效率 × 光源颜色
//   vec3 specularContribution = intensities.specular * waterProps.specularFactor * uLightColor;
//   specularContribution = vec3(0.0);

//   // 4. 次表面散射贡献 = 光照强度 × 材质散射特性 × 光源颜色
//   vec3 subsurfaceContribution =
//     intensities.subsurface * (waterProps.baseColor * waterProps.subsurfaceFactor) * uLightColor;

//   // 5. 环境反射贡献 = 菲涅尔强度 × 环境颜色
//   vec3 envReflection = textureCube(uEnvironmentMap, reflect(-V, N)).rgb;
//   vec3 environmentContribution = intensities.fresnel * envReflection;

//   // ============ 合成最终颜色 ============

//   // 水体本身的颜色（直接光照）
//   vec3 waterBodyColor = ambientContribution + diffuseContribution + specularContribution + subsurfaceContribution;

//   // 根据菲涅尔效应混合水体颜色和环境反射
//   vec3 finalColor = mix(waterBodyColor, environmentContribution, intensities.fresnel * 1.0);

//   // finalColor = mix(finalColor, vec3(1.0), 1.0 - vFoam);

//   // Gamma校正
//   finalColor = pow(finalColor, vec3(1.0 / 2.2));

//   gl_FragColor = vec4(finalColor, 1.0);

//   // ============ 调试输出 ============
//   // gl_FragColor = vec4(waterProps.baseColor, 1.0);     // 查看水体基础颜色
//   // gl_FragColor = vec4(vec3(intensities.fresnel), 1.0); // 查看菲涅尔强度
//   // gl_FragColor = vec4(waterBodyColor, 1.0);            // 查看水体本身颜色
//   // gl_FragColor = vec4(N, 1.0);
//   // gl_FragColor = vec4(normalColor, 1.0);
//   // gl_FragColor = vec4(vec3(vFoam), 1.0);
//   // gl_FragColor = vec4(subsurfaceContribution, 1.0);

// }

void main() {
  // 时间
  // float time = uTime;

  vec3 displacement = texture2D(uDisplacementMap, vWorldPosition.xz * 0.002).xyz;
  gl_FragColor = vec4(displacement, 1.0);
  // return;

  // 直接在 Fragment Shader 中计算法线
  vec2 gradient = texture2D(uGradientMap, vTexCoord).xy;
  vec2 gradient1 = texture2D(uGradientMap, vWorldPosition.xz * 0.002).xy;
  vec2 gradient2 = texture2D(uGradientMap, vWorldPosition.xz * 0.008).xy * 0.5;
  gradient = gradient1 + gradient2;
  // gl_FragColor = vec4(gradient.x, gradient.y, 0.0, 1.0);
  // gl_FragColor = vec4(gradient.x * 0.5 + 0.5, gradient.y * 0.5 + 0.5, 0.0, 1.0);
  float dDx_dx = texture2D(uDispDerivativeMap, vTexCoord).x;
  float dDz_dz = texture2D(uDispDerivativeMap, vTexCoord).y;
  float dDx_dz = texture2D(uDispDerivativeMap, vTexCoord).z;
  float dDz_dx = texture2D(uDispDerivativeMap, vTexCoord).w;
  float jacobian = (1.0 + dDx_dx) * (1.0 + dDz_dz) - dDx_dz * dDz_dx;

  // 归一化法线
  vec3 N = normalize(
    vec3(
      -gradient.x * (1.0 + dDz_dz) + gradient.y * dDz_dx,
      jacobian, // 不是固定的 1.0
      -gradient.y * (1.0 + dDx_dx) + gradient.x * dDx_dz
    )
  );
  vec3 normal = N;
  // normal = calculateCompleteWaterNormal(normal, vWorldPosition.xz, time);

  // 计算视线方向
  vec3 viewDir = normalize(uCameraPos - vWorldPosition);

  // 计算光照方向
  vec3 lightDir = normalize(uLightDir); // 外部已经计算好（反向）太阳光（平行光）的方向了

  // 计算半程向量
  vec3 halfwayDir = normalize(lightDir + viewDir);

  // 反射方向
  vec3 reflectDir = reflect(-viewDir, normal);

  // 光照参数
  vec3 upwelling = vec3(0, 0.2, 0.3); // 水中上涌光线颜色（偏蓝绿）
  vec3 sky = vec3(0.69, 0.84, 1); // 天空颜色（浅蓝）
  vec3 air = vec3(0.1, 0.1, 0.1); // 空气颜色（深灰）
  float nSnell = 1.34; // 水的折射率
  float reflectivity = 0.0; // 反射率
  float Kdiffuse = 0.91;

  reflectivity = calculateFresnelReflectivityAlgebraic(normal, viewDir, WATER_IOR, AIR_IOR);

  float dist = length(uCameraPos - vWorldPosition) * Kdiffuse;
  dist = 0.2;

  // sky = textureCube(uEnvironmentMap, vWorldPosition).rgb;

  vec3 color = dist * (reflectivity * sky + (1.0 - reflectivity) * upwelling) + (1.0 - dist) * air;
  // color = texture2D(uDisplacementMap, vTexCoord).rgb;
  // color = texture2D(uNormalMap, vTexCoord).rgb;
  // color = textureCube(uEnvironmentMap, vWorldPosition).rgb;
  // color = calculateDepthColor(uShallowWaterColor, uDeepWaterColor, vWaterDepth);
  // color = applyWaterColorAttenuation(color, vWaterDepth);

  color = pow(color, vec3(1.0 / 2.2));
  gl_FragColor = vec4(color, 1.0);
}

