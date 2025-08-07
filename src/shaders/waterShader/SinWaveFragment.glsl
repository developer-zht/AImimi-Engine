#ifdef GL_ES
precision highp float;
#endif

// 从 Vertex shader 传入的 Fragment varying
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vTexCoord;
varying vec3 vWorldPosition;
varying float vWaveHeight;

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
uniform vec3 uLightRadiance;
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

#define M_PI 3.1415926535897932384626433832795
#define TWO_PI 6.283185307
#define INV_PI 0.31830988618
#define INV_TWO_PI 0.15915494309

vec3 fresnelSchlick(float cosTheta, vec3 F0, float fresnelPower);
float distributionGGX(vec3 normal, vec3 halfwayVector, float roughness);
float GeometrySmith(vec3 normal, vec3 viewDir, vec3 lightDir, float roughness);

/**
 * Cook-Torrance PBR 模型 -- 基于渲染方程的 PBR 模型
 * 基于物理的渲染方程实现:
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
  vec3 kd = (1.0 - metallic) * (vec3(1.0) - ks);
  vec3 diffuse = kd * albedo / M_PI;

  float NdotL = max(dot(normal, lightDir), 0.0);

  return (diffuse + specular) * inputRadiance * NdotL;
}

/**
 * Cook-Torrance diffuse BRDF 项
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
 * Cook-Torrance specular BRDF项
 *  DFG / [4(ωo·n)(ωi·n)]
 *   - DFG: 微表面模型的三个核心函数乘积
 *     * D (Normal Distribution Function): 微表面法线分布函数（例：GGX）
 *     * F (Fresnel Equation): 菲涅尔反射率（例：Schlick近似）
 *     * G (Geometry Function): 几何遮蔽函数（例：Smith模型）
 *   - ωo·n: 观察方向与法线的点积（cosθo，θo为观察角）
 *   - ωi·n: 入射方向与法线的点积（cosθi，θi为入射角）
 *   - 分母4(ωo·n)(ωi·n): 能量守恒校正因子，补偿微表面模型的双重几何衰减
 *
 *  典型实现参考（以GGX为例）:
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
 * F (Fresnel Equation): 菲涅尔反射率
 *  F(v,h,F0) = F0 + (1−F0)(1−(v·h))⁵
 *   - v​​：观察方向向量（从表面指向相机）
 *   - h​​：半程向量 Halfway Vector
 * 首先我们想计算的是镜面反射和漫反射之间的比值，或者说与表面折射的光线相比，它反射了多少光线。
 * Fresnel-Schlick近似法接收一个参数F0，被称为0°入射角的反射率，或者说是直接(垂直)观察表面时有多少光线会被反射。
 * 这个参数F0会因为材料不同而不同，而且对于金属材质会带有颜色。在PBR金属流中我们简单地认为大多数的绝缘体在F0为0.04的时候看起来视觉上是正确的，对于金属表面我们根据反射率特别地指定F0。
 */
vec3 fresnelSchlick(float cosTheta, vec3 F0, float fresnelPower) {
  // return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0); // clamp 是防御式编程，避免 cosTheta 精度问题使得 1.0 - cosTheta < 0.0 从而带来的黑点
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), fresnelPower);
}
/**
 * D (Normal Distribution Function): 微表面法线分布函数
 *  α² / [π((n·h)²(α²−1)+1)²]
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
 * G (Geometry Function): 几何遮蔽函数
 * G(l,v,n,α) = G1(l) * G1(v)   // 分离遮蔽阴影
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

/**
 * 计算光照衰减系数
 */
float calculateAttenuation(vec3 fragPos, vec3 lightPos) {
  float distance = length(lightPos - fragPos);
  return 1.0 / (distance * distance);
}

/**
 * 计算次表面散射
 */
vec3 calculateSubsurfaceScattering(vec3 lightDir, vec3 viewDir, vec3 normal, vec3 thickness, vec3 scatterColor) {
  vec3 lightDirWS = lightDir + normal * 0.25;
  float VdotL = pow(clamp(dot(viewDir, -lightDirWS), 0.0, 1.0), 4.0);
  return scatterColor * VdotL * thickness;
}

/**
 * 计算体积散射
 */
vec3 calculateVolumeScattering(float depth, vec3 lightDir, vec3 viewDir) {
  // 瑞利散射（蓝光占主导）
  vec3 rayleigh = vec3(0.02, 0.1, 0.3);

  // 米氏散射（较大颗粒）
  vec3 mie = vec3(0.05, 0.15, 0.1);

  float scatteringFactor = exp(-depth * 0.1);
  return mix(rayleigh, mie, 0.3) * scatteringFactor;
}

/**
 * 计算环境光照 IBL
 */
vec3 sampleEnvironment(vec3 reflectDir) {
  return textureCube(uEnvironmentMap, reflectDir).rgb;
}
vec3 sampleEnvironment(vec3 reflectDir, float roughness) {
  // 根据粗糙度选择mipmap level
  float mipLevel = roughness * 8.0; // 假设8级mipmap
  return textureCube(uEnvironmentMap, reflectDir, mipLevel).rgb;
}

/**
 * 计算大气透视
 */
vec3 applyAtmosphericPerspective(vec3 color, float distance) {
  vec3 fogColor = vec3(0.7, 0.8, 0.9);
  float fogFactor = 1.0 - exp(-distance * 0.0001);
  return mix(color, fogColor, fogFactor);
}

/**
 * 水深可视化
 */
vec3 addDepthVisualization(vec3 color, float depth) {
  // 深水区更暗，浅水区透明度更高
  float depthAlpha = 1.0 - exp(-depth * 0.5);
  return mix(color, color * 0.3, depthAlpha);
}

/**
 * 泡沫效果
 */
float calculateFoam(vec3 normal, float waveHeight) {
  float steepness = 1.0 - normal.y;
  float heightFoam = smoothstep(0.5, 0.8, abs(waveHeight));
  return max(steepness * 0.3, heightFoam);
}

/**
 * 计算体积散射
 */
// float calculateCaustics(vec2 worldPos, float time) {
//   vec2 uv = worldPos * 0.1;
//   float caustics1 = texture2D(uCausticsMap, uv + time * 0.05).r;
//   float caustics2 = texture2D(uCausticsMap, uv * 1.3 - time * 0.03).r;
//   return min(caustics1, caustics2) * 2.0;
// }

/**
 * 程序化生成细节波浪的解析法线
 * 这样可以与你的主波浪保持物理一致性
 */
vec3 calculateAnalyticalDetailNormals(vec2 worldPos, float time) {
  vec3 detailNormal = vec3(0.0, 0.0, 0.0);

  // === 细节波浪层1: 微风产生的小波浪 ===
  {
    float amplitude = 0.02; // 很小的振幅
    float wavelength = 1.0; // 短波长
    float speed = 2.0; // 较快的传播
    vec2 direction = normalize(vec2(0.7, 0.3)); // 与主波浪不同方向

    float k = 2.0 * 3.14159 / wavelength;
    float phase = k * dot(direction, worldPos) - speed * time;

    // 解析求导: ∂h/∂x 和 ∂h/∂z
    float dhx = -amplitude * k * direction.x * cos(phase);
    float dhz = -amplitude * k * direction.y * cos(phase);

    detailNormal += vec3(dhx, 0.0, dhz) * 0.4; // 权重0.4
  }

  // === 细节波浪层2: 表面张力波（毛细波） ===
  {
    float amplitude = 0.01; // 更小的振幅
    float wavelength = 0.3; // 很短的波长
    float speed = 4.0; // 很快的传播
    vec2 direction = normalize(vec2(-0.5, 0.8));

    float k = 2.0 * 3.14159 / wavelength;
    float phase = k * dot(direction, worldPos) - speed * time + 0.5; // 添加相位偏移

    float dhx = -amplitude * k * direction.x * cos(phase);
    float dhz = -amplitude * k * direction.y * cos(phase);

    detailNormal += vec3(dhx, 0.0, dhz) * 0.3; // 权重0.3
  }

  // === 细节波浪层3: 高频噪声波 ===
  {
    // 使用多个正弦波叠加模拟复杂的高频扰动
    vec2 pos = worldPos * 0.5;
    float t = time * 1.5;

    // 第一个噪声波
    float noise1Phase = pos.x * 8.0 + pos.y * 6.0 - t * 3.0;
    float noise1 = sin(noise1Phase) * 0.005;
    float dnoise1x = cos(noise1Phase) * 8.0 * 0.005;
    float dnoise1z = cos(noise1Phase) * 6.0 * 0.005;

    // 第二个噪声波
    float noise2Phase = pos.x * 12.0 - pos.y * 8.0 + t * 2.5;
    float noise2 = sin(noise2Phase) * 0.003;
    float dnoise2x = cos(noise2Phase) * 12.0 * 0.003;
    float dnoise2z = cos(noise2Phase) * -8.0 * 0.003;

    detailNormal += vec3(dnoise1x + dnoise2x, 0.0, dnoise1z + dnoise2z) * 0.3;
  }

  return detailNormal;
}
/**
 * 改进的法线混合函数
 * 将主波浪法线与细节法线正确混合
 */
vec3 combineWaveNormals(vec3 mainNormal, vec2 worldPos, float time, float detailStrength) {
  // 获取解析的细节法线扰动
  vec3 detailPerturbation = calculateAnalyticalDetailNormals(worldPos, time);

  // 应用细节强度控制
  detailPerturbation *= detailStrength;

  // 将扰动添加到主法线
  vec3 perturbedNormal = mainNormal + detailPerturbation;

  return normalize(perturbedNormal);
}

/**
 * 基于物理的动态细节强度
 * 根据波浪状态和观察距离调整细节
 */
float calculateDetailStrength(vec3 worldPos, vec3 cameraPos, float waveHeight) {
  // 距离衰减 - 远处不需要太多细节
  float distance = length(cameraPos - worldPos);
  float distanceFactor = 1.0 / (1.0 + distance * 0.02);

  // 基于主波浪强度 - 大波浪时细节更明显
  float waveFactor = 0.3 + abs(waveHeight) * 0.7;

  // 组合因子
  return clamp(distanceFactor * waveFactor, 0.1, 1.0);
}

/**
 * 完整的解析法线计算流程
 * 在你的fragment shader中使用
 */
vec3 calculateCompleteAnalyticalNormal(
  vec3 vertexNormal, // 从vertex shader传入的主波浪法线
  vec2 worldPos, // 世界坐标
  vec3 cameraPos, // 相机位置
  float time, // 时间
  float waveHeight // 波浪高度
) {
  // 计算动态细节强度
  float detailStrength = calculateDetailStrength(vec3(worldPos.x, 0.0, worldPos.y), cameraPos, 5.0);

  // 混合主法线与细节法线
  vec3 finalNormal = combineWaveNormals(vertexNormal, worldPos, time, detailStrength);

  return finalNormal;
}

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

/**
 * // TOFIX: 
 * 计算环境光 Diffuse 部分
 */
// vec3 calculateEnvDiffuse(vec3 normal, vec3 lightDir, vec3 viewDir, float depth, float metallic) {
//   vec3 F0 = vec3(0.02);
//   F0 = mix(F0, albedo, metallic);
//   float NdotV = max(dot(normal, viewDir), 0.0);
//   vec3 F = fresnelSchlick(NdotV, F0, 5.0);
//   vec3 kd = (vec3(1.0) - F) * (1.0 - metallic);
//   vec3 reflectDir = reflect(-viewDir, normal);

//   // TOFIX: 这里的环境光计算不对
//   vec3 envRadiance = sampleEnvironment(reflectDir);
//   vec3 volumeScattering = calculateVolumeScattering(depth, lightDir, viewDir);

//   vec3 envDiffuse = kd * albedo * envRadiance + volumeScattering;

//   return envDiffuse;
// }

/**
 * // TOFIX: 
 * 计算环境光 Specular 部分
 */
// vec3 calculateEnvSpecular(vec3 normal, vec3 viewDir) {
//   vec3 F0 = vec3(0.02);
//   F0 = mix(F0, albedo, metallic);
//   float NdotV = max(dot(normal, viewDir), 0.0);
//   vec3 reflectDir = reflect(-viewDir, normal);

//   vec3 envReflection = sampleEnvironment(reflectDir);
//   vec3 envFresnel = fresnelSchlick(NdotV, F0, 5.0);
//   vec3 envSpecular = envReflection * envFresnel * reflectance;

//   return envSpecular;
// }

void main() {
  // 归一化法线
  vec3 normal = normalize(vNormal);
  // normal = calculateCompleteAnalyticalNormal(normal, vWorldPosition.xz, uCameraPos, uTime, vWaveHeight);

  // 计算视线方向
  vec3 viewDir = normalize(uCameraPos - vWorldPosition);

  // 计算光照方向
  vec3 lightDir = normalize(uLightDir); // 外部已经计算好（反向）太阳光（平行光）的方向了

  // 设置 albedo
  vec3 albedo = uWaterColor;
  // 设置泡沫
  float foam = calculateFoam(normal, vWaveHeight);
  albedo = mix(uWaterColor, vec3(1.0), foam * 0.2);
  // 设置金属度
  float metallic = 0.0;
  // 设置粗糙度
  float roughness = 0.1;

  vec3 ctRadiance = CookTorranceRadiance(albedo, metallic, roughness, normal, viewDir, lightDir, uLightRadiance, 5.0);

  // 计算直接光照的出射 Radiance
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
  vec3 directSpecular = CookTorranceSpecularBRDF(albedo, roughness, metallic, normal, viewDir, lightDir, 5.0);
  vec3 directBRDF = directDiffuse + directSpecular;
  vec3 directRadiance = directBRDF * uLightRadiance * NdotL;

  // 一定不要忘记做 Gamma 校正
  vec3 radiance = pow(clamp(directRadiance, 0.0, 1.0), vec3(1.0 / 2.2));

  gl_FragColor = vec4(radiance, 1.0);
}
