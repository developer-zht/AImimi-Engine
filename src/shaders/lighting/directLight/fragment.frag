#ifdef GL_ES
// 覆盖所有基于 float 的类型 -- float / vec2, vec3, vec4 / mat2, mat3, mat4
// 但是，int, ivec2 需要单独 precision highp int;
// sampler2D 采样器不受影响
precision highp float;
#endif

// Phong related variables
uniform sampler2D uDiffuseMap;
uniform vec3 uDiffuseColor;
uniform vec3 uSpecularColor;
uniform vec3 uLightPos;
uniform vec3 uCameraPos;
uniform vec3 uLightRadiance;

// Shadow map related variables（由 LightSystem 推送）
uniform sampler2D uShadowMap; // shadow map texture
uniform int uUseDepthTexture; // 外部通过 uniform 告知模式
uniform int uShadowMethod; // 0: hard shadow, 1: PCF, 2: PCSS
uniform float uShadowMapSize; // shadow map 分辨率
uniform float uFrustumSize; // 正交投影总宽度（orthoSize * 2）
uniform float uLightNearPlane; // 近裁剪面
uniform float uLightWorldSize; // 光源物理大小（PCSS 用）
uniform float uFilterRadius; // PCF 采样半径（像素数）

varying vec3 vWorldPos;
varying vec3 vNormalWorld;
varying vec2 vTexCoord;
varying vec4 vTangent;
// Shadow map related varying
varying vec4 vPositionFromLight;

// NUM_SAMPLES 用在 for 循环的上界和数组大小 poissonDisk[NUM_SAMPLES]。
// WebGL 1 要求循环上界和数组大小是编译期常量，uniform 不行
#define NUM_SAMPLES 50
#define NUM_RINGS 10
#define BLOCKER_SEARCH_NUM_SAMPLES NUM_SAMPLES
#define PCF_NUM_SAMPLES NUM_SAMPLES
// 纯数学常量，和引擎状态无关
#define EPS 1e-3
#define PI 3.141592653589793
#define PI2 6.283185307179586

// #define FILTER_RADIUS 10.0
// #define FRUSTUM_SIZE 400.0
// #define SHADOW_MAP_SIZE 2048.0
// #define LIGHT_SIZE_UV 20.0
// #define NEAR_PLANE 0.01

// ============================================================
// 辅助函数
// ============================================================

// 当 uUseDepthTexture == 0 时，用来解析使用 RGBA 方式编码的 gl_FragCoord.z 深度值
float unpack(vec4 rgbaDepth) {
  const vec4 bitShift = vec4(1.0, 1.0 / 256.0, 1.0 / (256.0 * 256.0), 1.0 / (256.0 * 256.0 * 256.0));
  return dot(rgbaDepth, bitShift);
}

// 仅在 uniformDiskSamples 函数中被使用
float rand_1to1(highp float x) {
  // -1 -1
  return fract(sin(x) * 10000.0);
}

// 在 poissonDiskSamples 和 uniformDiskSamples 两个函数中被使用
float rand_2to1(vec2 uv) {
  // 0 - 1
  const float a = 12.9898,
    b = 78.233,
    c = 43758.5453;
  float dt = dot(uv.xy, vec2(a, b)),
    sn = mod(dt, PI);
  return fract(sin(sn) * c);
}

vec2 poissonDisk[NUM_SAMPLES];

void poissonDiskSamples(const vec2 randomSeed) {
  float ANGLE_STEP = PI2 * float(NUM_RINGS) / float(NUM_SAMPLES);
  float INV_NUM_SAMPLES = 1.0 / float(NUM_SAMPLES);

  float angle = rand_2to1(randomSeed) * PI2;
  float radius = INV_NUM_SAMPLES;
  float radiusStep = radius;

  for (int i = 0; i < NUM_SAMPLES; i++) {
    poissonDisk[i] = vec2(cos(angle), sin(angle)) * pow(radius, 0.75);
    radius += radiusStep;
    angle += ANGLE_STEP;
  }
}

void uniformDiskSamples(const vec2 randomSeed) {
  float randNum = rand_2to1(randomSeed);
  float sampleX = rand_1to1(randNum);
  float sampleY = rand_1to1(sampleX);

  float angle = sampleX * PI2;
  float radius = sqrt(sampleY);

  for (int i = 0; i < NUM_SAMPLES; i++) {
    poissonDisk[i] = vec2(radius * cos(angle), radius * sin(angle));

    sampleX = rand_1to1(sampleY);
    sampleY = rand_1to1(sampleX);

    angle = sampleX * PI2;
    radius = sqrt(sampleY);
  }
}

// ============================================================
// 辅助函数
// ============================================================

float getShadowBias(float biasC, float filterRadiusUV) {
  // 当前片元的法线（世界空间）
  vec3 normal = normalize(vNormalWorld);

  // 从片元指向光源的方向
  vec3 lightDir = normalize(uLightPos - vWorldPos);

  // fragSize = 一个 shadow map 像素在世界空间中覆盖的大小
  //
  // FRUSTUM_SIZE / SHADOW_MAP_SIZE = 正交投影总宽度 / shadow map 分辨率
  //                                = 400 / 2048 ≈ 0.195
  //                                = 一个像素对应的世界空间宽度
  //
  // / 2. 是因为 ortho(-s, s) 总宽度是 2s，这里 FRUSTUM_SIZE 已经是 2s
  // 实际上这取决于你的 ortho 设置，可能需要调整
  //
  // (1. + ceil(filterRadiusUV)) 是 PCF 的放大因子：
  //   PCF 采样周围的像素，bias 也要相应放大，否则周围采样点会出现 acne
  //   无 PCF 时 filterRadiusUV = 0，ceil(0) = 0，系数 = 1（不放大）
  float fragSize = (1.0 + ceil(filterRadiusUV)) * (uFrustumSize / uShadowMapSize / 2.0);

  // dot(normal, lightDir) = cos(θ)
  //   θ = 法线和光照方向的夹角
  //
  // 当表面正对光源：cos(θ) ≈ 1 → 1 - 1 = 0 → bias = fragSize * c（最小 bias）
  // 当表面平行光线：cos(θ) ≈ 0 → 1 - 0 = 1 → bias = fragSize * c（最大 bias）
  //
  // max(fragSize, ...) 保证 bias 至少是一个像素大小
  // c 是手动调节系数（外部传入，用来微调）
  //
  // 物理直觉：表面越倾斜，同一个像素内的深度变化越大，需要的 bias 越大
  return max(fragSize, fragSize * (1.0 - dot(normal, lightDir))) * biasC;

}

// ============================================================
// 硬阴影
// ============================================================

float calVisibilityByShadowMap(sampler2D shadowMap, vec4 shadowCoords, float biasC, float filterRadiusUV) {
  float depth = 0.0;
  if (uUseDepthTexture == 1) {
    depth = texture2D(shadowMap, shadowCoords.xy).r;
  } else {
    vec4 rgbaDepth = texture2D(shadowMap, shadowCoords.xy);
    depth = unpack(rgbaDepth);
  }

  // 当前片元在光源空间中的深度（已经变换到 [0,1]）
  float cur_depth = shadowCoords.z;

  // 计算自适应 bias
  float bias = getShadowBias(biasC, filterRadiusUV);

  // 当前深度 - bias 仍然 > shadow map 记录的深度
  // → 说明在这个方向上，有更近的物体挡住了光
  // → 在阴影中 → 返回 0（不可见）
  // 当前深度 ≤ shadow map 深度（考虑 bias 后）
  // → 没有被遮挡 → 返回 1（可见）

  // 函数计算比分支计算更快
  return step(0.0, depth + EPS - cur_depth + bias);
  // return cur_depth - bias >= depth + EPS
  //   ? 0.0
  //   : 1.0;
}

// float calVisibilityByShadowMap(sampler2D shadowMap, vec4 shadowCoords) {
//   float depth = 0.0;
//   if (uUseDepthTexture == 1) {
//     depth = texture2D(shadowMap, shadowCoords.xy).r;
//   } else {
//     vec4 rgbaDepth = texture2D(shadowMap, shadowCoords.xy);
//     depth = unpack(rgbaDepth);
//   }
//   return shadowCoords.z > depth + EPS
//     ? 0.0
//     : 1.0;
// }

// ============================================================
// PCF 方法
// ============================================================

float PCF(sampler2D shadowMap, vec4 shadowCoords, float biasC, float filterRadiusUV) {
  // 用当前片元的 uv 坐标作为随机种子，生成 NUM_SAMPLES 个泊松圆盘采样点
  // 存入 poissonDisk[0..49]
  //
  // 为什么用 poissonDisk 而不是均匀网格？
  //   均匀网格会产生规则的条纹 artifact
  //   泊松圆盘保证采样点之间有最小距离，既随机又均匀
  //
  // 为什么用 coords.xy 做种子？
  //   让相邻像素的采样模式不同，避免整齐的噪声图案
  poissonDiskSamples(shadowCoords.xy);

  // 累计"在阴影中"的采样数
  float nonVisibility = 0.0;

  for (int i = 0; i < NUM_SAMPLES; i++) {
    // poissonDisk[i] 是单位圆内的采样偏移（范围约 [-1, 1]）
    // × filterRadiusUV 缩放到实际的 UV 空间采样半径
    // filterRadiusUV = FILTER_RADIUS / SHADOW_MAP_SIZE = 10 / 2048 ≈ 0.00488
    // 即在 shadow map 上偏移约 10 个像素的范围
    vec2 offset = poissonDisk[i] * filterRadiusUV;

    // 在偏移位置做一次硬阴影判断
    float visibility = calVisibilityByShadowMap(
      shadowMap,
      shadowCoords + vec4(offset, 0.0, 0.0),
      biasC,
      filterRadiusUV
    );

    nonVisibility += visibility == 1.0 ? 0.0 : 1.0;
  }

  // nonVisibility = 在阴影中的采样数
  // nonVisibility / NUM_SAMPLES = 阴影中的比例
  // 1 - 比例 = 可见度
  return 1.0 - nonVisibility / float(NUM_SAMPLES);
}

// ============================================================
// PCSS 方法
// ============================================================

// 寻找遮挡物算法
// 先搞清楚遮挡物是什么 ---- 比当前片元深度小的都有可能成为遮挡物
float findBlocker(sampler2D shadowMap, vec2 uv, float zReceiver) {
  // uv: 当前片元在 shadow map 上的 UV 坐标
  // zReceiver: 当前片元在光源空间的深度

  // 找到的遮挡物数量
  int blockerNum = 0;

  // 遮挡物深度累加值
  float blockDepth = 0.0;

  // 当前片元在光源空间的 z 值（clip space，未除以 w）
  // 用于计算搜索半径
  float posZFromLight = vPositionFromLight.z;

  // 搜索半径（UV 空间）
  //
  // 物理含义：从光源看过去，光源的物理大小在 shadow map 上投影多大？
  //
  // LIGHT_SIZE_UV = LIGHT_WORLD_SIZE / FRUSTUM_SIZE = 5 / 400 = 0.0125
  //   光源的世界大小 / 正交投影范围 = 光源在 UV 空间的大小
  //
  // (posZFromLight - NEAR_PLANE) / posZFromLight ≈ 1（近似为 1）
  //   这是一个深度相关的缩放因子
  //   对正交投影来说这个因子几乎无意义（接近 1）
  //   对透视投影（聚光灯）有用——越远处搜索范围越小
  //
  // 直觉：光源越大（LIGHT_WORLD_SIZE 越大），搜索范围越大，因为更大的光源能"看到"更多的遮挡物
  float lightSizeUV = uLightWorldSize / uFrustumSize;
  float searchRadius = lightSizeUV * (posZFromLight - uLightNearPlane) / posZFromLight;

  // 生成泊松圆盘采样模式
  poissonDiskSamples(uv);

  for (int i = 0; i < NUM_SAMPLES; i++) {
    // 在搜索半径内的随机位置采样 shadow map 深度
    // float shadowDepth = unpack(texture2D(shadowMap, uv + poissonDisk[i] * searchRadius));
    float shadowDepth = 0.0;
    if (uUseDepthTexture == 1) {
      shadowDepth = texture2D(shadowMap, uv + poissonDisk[i] * searchRadius).r;
    } else {
      shadowDepth = unpack(texture2D(shadowMap, uv + poissonDisk[i] * searchRadius));
    }

    if (zReceiver > shadowDepth) {
      // 如果当前片元比采样到的深度更远
      // → 该采样点是一个遮挡物（比我更靠近光源）
      blockerNum++;
      blockDepth += shadowDepth;
    }
  }

  if (blockerNum == 0)
    // 没找到任何遮挡物 → 完全不在阴影中
    // 返回 -1 作为"未找到"的标记
    return -1.0;
  else
    // 返回所有遮挡物的平均深度
    // 这个值越小（遮挡物离光源越近），阴影越软
    return blockDepth / float(blockerNum);
}

// 阴影软硬程度取决于遮挡物离光源和接收面的距离
// 遮挡物离接收面越远 → 半影区域越大 → 阴影越软
// 遮挡物紧贴接收面 → 几乎没有半影 → 硬阴影
// 对每个像素：
//   ①  findBlocker
//       在搜索范围内采样 shadow map
//       找到所有比我近的深度值（遮挡物）
//       算平均深度 d_blocker
//          │
//          ▼
//   ②  计算 penumbra
//       penumbra = lightSize × (d_receiver - d_blocker) / d_blocker
//          │
//          ▼
//   ③  PCF（动态半径）
//       用 penumbra 作为采样半径
//       在该半径内泊松采样 N 次
//       统计"在阴影中"的比例
//       返回可见度 [0, 1]
float PCSS(sampler2D shadowMap, vec4 shadowCoords, float biasC) {
  // 当前片元在光源空间的深度（[0,1] 范围）
  float zReceiver = shadowCoords.z;

  // STEP 1: avgblocker depth
  // 在搜索范围内找所有遮挡物，算平均深度
  float avgBlockerDepth = findBlocker(shadowMap, shadowCoords.xy, zReceiver);

  // avgBlockerDepth = -1 → 没有遮挡物 → 完全可见
  if (avgBlockerDepth < -EPS) return 1.0;

  // STEP 2: penumbra size
  float lightSizeUV = uLightWorldSize / uFrustumSize;
  float penumbra = (zReceiver - avgBlockerDepth) * lightSizeUV / avgBlockerDepth;
  // 半影大小公式（相似三角形推导）：
  //
  //        光源宽度 (LIGHT_SIZE_UV)
  //       ╔════════════╗
  //       ║            ║
  //       ╚══════╤═════╝
  //              │ d_blocker (avgBlockerDepth)
  //         ─────┼─────  ← 遮挡物
  //              │
  //              │ d_receiver - d_blocker
  //              │
  //     ────╱────┼────╲────  ← 接收面 (zReceiver)
  //     半影宽度 = ?
  //
  // 由相似三角形：
  //   penumbra / LIGHT_SIZE_UV = (d_receiver - d_blocker) / d_blocker
  //   penumbra = LIGHT_SIZE_UV * (d_receiver - d_blocker) / d_blocker
  //
  // 遮挡物越远（d_blocker 越小）→ 分子越大、分母越小 → penumbra 越大 → 阴影越软
  // 遮挡物贴着接收面（d_receiver ≈ d_blocker）→ 分子 ≈ 0 → penumbra ≈ 0 → 硬阴影

  // 用半影大小作为 PCF 的采样半径
  // 阴影越软的区域，PCF 采样范围越大
  float filterRadiusUV = penumbra;

  // STEP 3: filtering
  // 用动态的 filterRadiusUV 做 PCF
  // 这就是 PCSS 相比普通 PCF 的关键区别：
  //   PCF：全局固定 filterRadius → 阴影到处一样软
  //   PCSS：每个像素根据遮挡物距离动态算 filterRadius → 近硬远软
  return PCF(shadowMap, shadowCoords, biasC, filterRadiusUV);
}

vec3 blinnPhong() {
  vec3 color = texture2D(uDiffuseMap, vTexCoord).rgb;
  color = pow(color, vec3(2.2));

  vec3 ambient = 0.05 * color;

  vec3 lightDir = normalize(uLightPos);
  vec3 normal = normalize(vNormalWorld);
  float diff = max(dot(lightDir, normal), 0.0);
  vec3 diffuse = diff * uLightRadiance * color;

  vec3 viewDir = normalize(uCameraPos - vWorldPos);
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(halfDir, normal), 0.0), 32.0);
  vec3 specular = uSpecularColor * uLightRadiance * spec;

  vec3 radiance = ambient + diffuse + specular;
  vec3 phongColor = pow(radiance, vec3(1.0 / 2.2));
  return phongColor;
}

void main(void ) {
  // 透视除法 + 映射到 [0,1]
  vec3 shadowCoords = clamp(vPositionFromLight.xyz / vPositionFromLight.w * 0.5 + 0.5, 0.0, 1.0);
  // vec3 shadowCoords = vPositionFromLight.xyz / vPositionFromLight.w / 2.0 + 0.5;

  float visibility = 1.0;
  float nonePCFBiasC = 0.4;
  float pcfBiasC = 0.08;

  if (uShadowMethod == 0) {
    visibility = calVisibilityByShadowMap(uShadowMap, vec4(shadowCoords, 1.0), nonePCFBiasC, 0.0);
  } else if (uShadowMethod == 1) {
    // 普通 PCF：用户设定的固定半径
    float filterRadiusUV = uFilterRadius / uShadowMapSize;
    visibility = PCF(uShadowMap, vec4(shadowCoords, 1.0), pcfBiasC, filterRadiusUV);
  } else if (uShadowMethod == 2) {
    // PCSS：动态半径（由 penumbra 大小决定）
    visibility = PCSS(uShadowMap, vec4(shadowCoords, 1.0), pcfBiasC);
  }

  vec3 phongColor = blinnPhong();

  gl_FragColor = vec4(phongColor * visibility, 1.0);
}
