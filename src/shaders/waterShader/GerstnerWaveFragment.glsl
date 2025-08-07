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

/**
 * 计算菲涅尔反射系数
 * 基于Schlick近似
 */
float calculateFresnel(vec3 viewDir, vec3 normal, float refractionIndex) {
  float cosTheta = max(dot(viewDir, normal), 0.0);
  float r0 = pow((1.0 - refractionIndex) / (1.0 + refractionIndex), 2.0);
  float fresnel = r0 + (1.0 - r0) * pow(1.0 - cosTheta, uFresnelPower);

  return mix(0.02, 1.0, fresnel); // 最小反射率 2%
}

/**
 * 改进的菲涅尔计算
 */
float calculateImprovedFresnel(vec3 viewDir, vec3 normal, float ior) {
  float cosTheta = max(dot(viewDir, normal), 0.0);
  float eta = 1.0 / ior;
  float r0 = pow((eta - 1.0) / (eta + 1.0), 2.0);
  float fresnel = r0 + (1.0 - r0) * pow(1.0 - cosTheta, 5.0);
  return clamp(fresnel, 0.02, 0.98);
}

/**
 * 简单的Blinn-Phong光照计算
 */
// vec3 calculateBlinnPhong(vec3 lightDir, vec3 viewDir, vec3 normal, vec3 lightColor, vec3 materialColor) {
//   // 环境光
//   vec3 ambient = materialColor * 0.3;

//   // 漫反射
//   float diff = max(dot(normal, lightDir), 0.0);
//   vec3 diffuse = diff * lightColor * materialColor;

//   // 镜面反射
//   vec3 halfwayDir = normalize(lightDir + viewDir);
//   float spec = pow(max(dot(normal, halfwayDir), 0.0), 10.0);
//   vec3 specular = spec * lightColor;

//   // return ambient + diffuse;
//   return ambient + diffuse;
//   // return vec3(diff);
// }

/**
 * 基于物理的水体散射颜色
 */
vec3 calculateWaterScattering(vec3 viewDir, vec3 normal, float depth) {
  // 水体的散射特性：蓝绿色占主导
  vec3 scatteringColor = vec3(0.0, 0.4, 0.6);

  // 深度影响散射
  float depthFactor = exp(-depth * 0.1);

  // 视角影响 - 掠射角看到更多散射
  float viewAngle = abs(dot(viewDir, normal));
  float scatteringStrength = mix(0.8, 0.3, viewAngle);

  return mix(uDeepWaterColor, scatteringColor, depthFactor * scatteringStrength);
}

/**
 * 改进的水面反射计算
 */
vec3 calculateWaterReflection(vec3 viewDir, vec3 normal) {
  vec3 reflectDir = reflect(-viewDir, normal);
  vec3 reflectionColor = vec3(0.5, 0.7, 1.0); // 默认天空色

  if (uUseEnvironmentMap == 1) {
    reflectionColor = textureCube(uEnvironmentMap, reflectDir).rgb;

    // 重要：控制反射亮度，避免过曝
    reflectionColor = min(reflectionColor, vec3(2.0));

    // 简单的tone mapping
    reflectionColor = reflectionColor / (reflectionColor + vec3(1.0));

    // 还原一些亮度
    reflectionColor = pow(reflectionColor, vec3(0.8));
  }

  return reflectionColor;
}

/**
 * 水面镜面高光 (太阳反射)
 */
float calculateSunSpecular(vec3 lightDir, vec3 viewDir, vec3 normal) {
  vec3 halfwayDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfwayDir), 0.0), 200.0); // 高光锐度

  // 添加太阳盘面大小的模拟
  float sunSize = 0.02;
  spec = smoothstep(0.0, sunSize, spec);

  return spec;
}

/**
 * 次表面散射近似
 */
vec3 calculateSubsurfaceScattering(vec3 lightDir, vec3 viewDir, vec3 normal, vec3 waterColor) {
  // 光线穿透水面的散射效果
  vec3 subsurfaceDir = lightDir + normal * 0.3;
  float subsurface = max(0.0, dot(viewDir, -subsurfaceDir));
  subsurface = pow(subsurface, 2.0);

  return waterColor * subsurface * 0.3;
}

/**
 * 生成程序化泡沫
 * 基于波高和法线变化
 */
// float calculateFoam(float waveHeight, vec3 normal) {
//   // 基于波峰高度生成泡沫
//   float heightFoam = smoothstep(0.4, 0.7, abs(waveHeight));

//   // 基于法线变化（波浪陡峭程度）生成泡沫
//   float normalFactor = 1.0 - abs(normal.y);
//   float slopeFoam = smoothstep(0.5, 0.8, normalFactor);

//   // 添加一些噪声变化
//   float noise1 = sin(vWorldPosition.x * 8.0 + uTime * 1.5) * cos(vWorldPosition.z * 6.0 + uTime * 1.2);
//   float noise2 = sin(vWorldPosition.x * 15.0 + uTime * 2.5) * cos(vWorldPosition.z * 12.0 + uTime * 2.0);
//   float noise = (noise1 * 0.7 + noise2 * 0.3 + 2.0) * 0.25; // 归一化并减少强度

//   return max(heightFoam, slopeFoam) * noise;
// }

/**
 * 简单的水深效果
 * 基于世界坐标和波高模拟深浅变化
 */
// vec3 calculateDepthColor(vec3 baseColor, float depth) {
//   // 简单的深度衰减
//   float depthFactor = exp(-abs(depth) * 0.15);
//   vec3 deepColor = mix(uDeepWaterColor, uWaterColor * 0.6, 0.5);
//   return mix(deepColor, baseColor, depthFactor);
// }
/**
 * 改进的水深和颜色计算
 */
vec3 calculateDepthBasedColor(float depth, vec3 baseColor) {
  // 基于Beer-Lambert定律的光衰减
  float depthFactor = exp(-abs(depth) * 0.15);

  // 不同深度的颜色变化
  vec3 shallowColor = mix(uShallowWaterColor, baseColor, 0.5);
  vec3 deepColor = mix(uDeepWaterColor, baseColor * 0.3, 0.7);

  return mix(deepColor, shallowColor, depthFactor);
}

/**
 * 动态法线扰动 (模拟小波浪)
 */
vec3 addNormalPerturbation(vec3 normal, vec2 worldPos, float time) {
  // 多层次的法线扰动
  vec2 uv1 = worldPos * 0.05 + time * 0.02;
  vec2 uv2 = worldPos * 0.08 + time * 0.015;

  // 简单的噪声函数
  float noise1 = sin(uv1.x * 10.0) * cos(uv1.y * 8.0);
  float noise2 = sin(uv2.x * 15.0) * cos(uv2.y * 12.0);

  vec3 perturbation = vec3(noise1, 0.0, noise2) * 0.1;
  return normalize(normal + perturbation);
}

void main() {
  // 归一化法线
  vec3 normal = normalize(vNormal);

  // 计算视线方向
  vec3 viewDir = normalize(uCameraPos - vWorldPosition);

  /**
 * 计算光照方向（这里假设使用定向光）
 *     理论上说这里要反向取模，但是 WebGLRenderer.ts 中的
 *     let updatedLightParamters: UpdatedLightParamters = {
 *       uLightVP: lightVP,
 *       uLightDir: lightDir
 *     }
 *     会实时更新 uLightDir，并且这个 uLightDir 已经被反向了（但没有取模）
 */
  // vec3 lightDir = normalize(-uLightDir);
  vec3 lightDir = normalize(uLightDir);

  // 基础水体颜色
  // vec3 baseWaterColor = uWaterColor;

  // 添加法线扰动
  normal = addNormalPerturbation(normal, vWorldPosition.xz, uTime);

  // 如果有diffuse贴图，采样纹理颜色
  // if (uUseDiffuseMap == 1) {
  //   vec3 diffuseColor = texture2D(uDiffuseMap, vTexCoord).rgb;
  //   diffuseColor = pow(diffuseColor, vec3(2.2));
  //   baseWaterColor *= diffuseColor; // 从sRGB转到线性空间
  // }

  // 如果有法线贴图，调整法线
  if (uUseNormalMap == 1) {
    // 动态UV坐标
    vec2 uv1 = vWorldPosition.xz * 0.02 + uTime * 0.01;
    vec2 uv2 = vWorldPosition.xz * 0.04 + uTime * 0.008;

    vec3 normal1 = texture2D(uNormalMap, uv1).rgb * 2.0 - 1.0;
    vec3 normal2 = texture2D(uNormalMap, uv2).rgb * 2.0 - 1.0;

    // 混合多层法线
    vec3 combinedNormal = normalize(normal1 + normal2 * 0.5);
    normal = normalize(normal + combinedNormal * 0.3);
  }

  // 计算深度颜色效果
  float depth = abs(vWaveHeight) + 2.0; // 简单的深度计算
  // vec3 waterColor = calculateDepthColor(baseWaterColor, depth);
  vec3 waterColor = calculateDepthBasedColor(depth, uWaterColor);

  // // 计算菲涅尔效应
  // float fresnel = calculateFresnel(viewDir, normal, uRefractiveIndex);

  // // 使用 Blinn-Phong 模型计算基础光照
  // vec3 litColor = calculateBlinnPhong(uLightDir, viewDir, normal, uLightRadiance, uWaterColor);

  // // 环境反射
  // vec3 reflectionColor = vec3(0.5, 0.7, 1.0); // 默认天空色
  // if (uUseEnvironmentMap == 1) {
  //   vec3 reflectDir = reflect(-viewDir, normal);
  //   // CubeMap 采样
  //   reflectionColor = textureCube(uEnvironmentMap, reflectDir).rgb;
  //   // // 简单的球面映射（实际应该用立方体贴图）
  //   // vec2 envCoord = vec2(atan(reflectDir.z, reflectDir.x) / (2.0 * 3.14159) + 0.5, acos(reflectDir.y) / 3.14159);
  //   // reflectionColor = textureCube(uEnvironmentMap, envCoord).rgb;
  // }

  // 水体散射颜色
  vec3 scatteringColor = calculateWaterScattering(viewDir, normal, depth);

  // 环境反射
  vec3 reflectionColor = calculateWaterReflection(viewDir, normal);

  // 菲涅尔效应
  float fresnel = calculateImprovedFresnel(viewDir, normal, uRefractiveIndex);

  // 太阳镜面反射
  float sunSpecular = calculateSunSpecular(lightDir, viewDir, normal);
  vec3 sunColor = uLightRadiance * sunSpecular;

  // 次表面散射
  vec3 subsurface = calculateSubsurfaceScattering(lightDir, viewDir, normal, waterColor);

  // // 计算泡沫
  // float foam = calculateFoam(vWaveHeight, normal);
  // vec3 foamColor = vec3(1.0); // 白色泡沫

  // 1. 基础水体颜色 (散射 + 次表面散射)
  vec3 baseWaterColor = scatteringColor + subsurface;

  // 2. 反射贡献 (基于菲涅尔)
  float reflectionStrength = fresnel * uReflectance;

  // 3. 能量守恒的混合
  vec3 finalColor = mix(baseWaterColor, reflectionColor, reflectionStrength);

  // 4. 添加太阳高光
  finalColor += sunColor;

  // 5. 大气透视效果 (可选)
  float distance = length(uCameraPos - vWorldPosition);
  float fogFactor = exp(-distance * 0.001);
  finalColor = mix(vec3(0.7, 0.8, 0.9), finalColor, fogFactor);

  // === 关键：gamma校正和色调映射 ===
  finalColor = pow(finalColor, vec3(0.8)); // 提亮
  finalColor = finalColor / (finalColor + vec3(1.0)); // tone mapping

  // 混合所有效果 mix(x, y, a) 是一个混合函数，等价于 x * (1−a) + y * a
  // vec3 finalColor = mix(litColor, reflectionColor, fresnel * uReflectance);
  // vec3 finalColor = mix(litColor, reflectionColor, fresnel);
  // finalColor = mix(finalColor, foamColor, foam * 0.3);

  // 添加一些动态的水面高光
  // float sparkleNoise = sin(vWorldPosition.x * 25.0 + uTime * 2.0) * cos(vWorldPosition.z * 20.0 + uTime * 1.8);
  // float sparkle = max(0.0, sparkleNoise * sparkleNoise) * 0.05; // 使用平方减少噪点
  // finalColor += sparkle * lightColor;

  // 输出最终颜色，包含透明度
  gl_FragColor = vec4(finalColor, 1.0);
  // gl_FragColor = vec4(reflectionColor, 1.0);
  // gl_FragColor = vec4(vec3(uReflectance), 1.0);
  // gl_FragColor = vec4(vec3(fresnel * uReflectance), 1.0);
}
