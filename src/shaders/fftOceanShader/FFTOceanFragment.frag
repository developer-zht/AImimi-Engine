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

uniform sampler2D uDisplacementMap;

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

// ==================== Fresnel ====================
// Schlick近似（更快，略不精确）
// float fresnelSchlick(float cosTheta, float waterIOR, float airIOR) {
//   // 水的F0值
//   float F0 = pow((airIOR - waterIOR) / (airIOR + waterIOR), 2.0); // ≈ 0.02
//   return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
// }

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
    vec2 gradientCenter = texture2D(uNormalMap, vTexCoord).xy;
    gradient = gradientCenter;
  } else if (perturbationMode == 1) {
    vec2 gradientRight = texture2D(uNormalMap, vTexCoord + vec2(texelSize.x, 0.0)).xy;
    gradient = gradientRight;
  } else if (perturbationMode == 2) {
    vec2 gradientUp = texture2D(uNormalMap, vTexCoord + vec2(0.0, texelSize.y)).xy;
    gradient = gradientUp;
  }

  vec2 detailGradient = texture2D(uNormalMap, vTexCoord * 4.0).xy * 0.3;

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

void main() {
  // 基础向量
  vec3 N = perturbNormal(2);
  // vec3 N = normalize(vNormal);
  vec3 V = normalize(uCameraPos - vWorldPosition);
  vec3 L = normalize(uLightDir);

  // 获取水的材质属性
  WaterProperties waterProps = getWaterProperties(0, 0.1);

  // 计算菲涅尔反射率
  float reflectivity = calculateFresnelReflectivityAlgebraic(N, V, WATER_IOR, AIR_IOR);

  // 计算各种光照强度
  LightingIntensities intensities = calculateLightingIntensities(
    N,
    V,
    L,
    vWaveHeight,
    reflectivity,
    waterProps.shininess
  );

  // ============ 最终光照计算 ============

  // 1. 环境光贡献 = 光照强度 × 材质反射效率 × 光源颜色
  vec3 ambientColor = vec3(0.1, 0.1, 0.1);
  vec3 ambientContribution = intensities.ambient * (waterProps.baseColor * waterProps.ambientFactor) * ambientColor;

  // 2. 漫反射贡献 = 光照强度 × 材质反射效率 × 光源颜色
  vec3 diffuseContribution = intensities.diffuse * (waterProps.baseColor * waterProps.diffuseFactor) * uLightColor;

  // 3. 镜面反射贡献 = 光照强度 × 材质反射效率 × 光源颜色
  vec3 specularContribution = intensities.specular * waterProps.specularFactor * uLightColor;
  specularContribution = vec3(0.0);

  // 4. 次表面散射贡献 = 光照强度 × 材质散射特性 × 光源颜色
  vec3 subsurfaceContribution =
    intensities.subsurface * (waterProps.baseColor * waterProps.subsurfaceFactor) * uLightColor;

  // 5. 环境反射贡献 = 菲涅尔强度 × 环境颜色
  vec3 envReflection = textureCube(uEnvironmentMap, reflect(-V, N)).rgb;
  vec3 environmentContribution = intensities.fresnel * envReflection;

  // ============ 合成最终颜色 ============

  // 水体本身的颜色（直接光照）
  vec3 waterBodyColor = ambientContribution + diffuseContribution + specularContribution + subsurfaceContribution;

  // 根据菲涅尔效应混合水体颜色和环境反射
  vec3 finalColor = mix(waterBodyColor, environmentContribution, intensities.fresnel * 1.0);

  // finalColor = mix(finalColor, vec3(1.0), 1.0 - vFoam);

  // Gamma校正
  finalColor = pow(finalColor, vec3(1.0 / 2.2));

  gl_FragColor = vec4(finalColor, 1.0);

  // ============ 调试输出 ============
  // gl_FragColor = vec4(waterProps.baseColor, 1.0);     // 查看水体基础颜色
  // gl_FragColor = vec4(vec3(intensities.fresnel), 1.0); // 查看菲涅尔强度
  // gl_FragColor = vec4(waterBodyColor, 1.0);            // 查看水体本身颜色
  // gl_FragColor = vec4(N, 1.0);
  // gl_FragColor = vec4(normalColor, 1.0);
  // gl_FragColor = vec4(vec3(vFoam), 1.0);
  // gl_FragColor = vec4(subsurfaceContribution, 1.0);

}

// void main() {
//   // 时间
//   // float time = uTime;

//   // 归一化法线
//   vec3 normal = normalize(vNormal);
//   // normal = calculateCompleteWaterNormal(normal, vWorldPosition.xz, time);

//   // 计算视线方向
//   vec3 viewDir = normalize(uCameraPos - vWorldPosition);

//   // 计算光照方向
//   vec3 lightDir = normalize(uLightDir); // 外部已经计算好（反向）太阳光（平行光）的方向了

//   // 计算半程向量
//   vec3 halfwayDir = normalize(lightDir + viewDir);

//   // 反射方向
//   vec3 reflectDir = reflect(-viewDir, normal);

//   // 光照参数
//   vec3 upwelling = vec3(0, 0.2, 0.3); // 水中上涌光线颜色（偏蓝绿）
//   vec3 sky = vec3(0.69, 0.84, 1); // 天空颜色（浅蓝）
//   vec3 air = vec3(0.1, 0.1, 0.1); // 空气颜色（深灰）
//   float nSnell = 1.34; // 水的折射率
//   float reflectivity = 0.0; // 反射率
//   float Kdiffuse = 0.91;

//   reflectivity = calculateFresnelReflectivityAlgebraic(normal, viewDir, WATER_IOR, AIR_IOR);

//   float dist = length(uCameraPos - vWorldPosition) * Kdiffuse;
//   dist = 0.2;

//   // sky = textureCube(uEnvironmentMap, vWorldPosition).rgb;

//   vec3 color = dist * (reflectivity * sky + (1.0 - reflectivity) * upwelling) + (1.0 - dist) * air;
//   // color = texture2D(uDisplacementMap, vTexCoord).rgb;
//   // color = texture2D(uNormalMap, vTexCoord).rgb;
//   // color = textureCube(uEnvironmentMap, vWorldPosition).rgb;
//   // color = calculateDepthColor(uShallowWaterColor, uDeepWaterColor, vWaterDepth);
//   // color = applyWaterColorAttenuation(color, vWaterDepth);

//   color = pow(color, vec3(1.0 / 2.2));
//   gl_FragColor = vec4(color, 1.0);
// }

