#ifdef GL_ES
precision highp float;
#endif

// prettier-ignore
#extension GL_EXT_draw_buffers: enable

// GBuffer 输出用的纹理
uniform sampler2D uKd; // Diffuse Map（从 OBJ 加载）
uniform sampler2D uNt; // Normal Map（从 OBJ 加载）

// Shadow 相关 uniform（由 LightSystem 推送）
uniform sampler2D uShadowMap; // Shadow Map -- 从 Shadow Pass 中获取
uniform int uUseDepthTexture;
uniform mat4 uLightVP;

// PCSS 需要的参数（同样由 LightSystem 推送）
uniform vec3 uLightPos;
uniform float uShadowMapSize; // shadow map 分辨率
uniform float uFrustumSize; // 正交投影总宽度（orthoSize * 2）
uniform float uLightNearPlane; // 近裁剪面
uniform float uLightWorldSize; // 光源物理大小（PCSS 用）

// 顶点插值
varying vec3 vPosWorld;
varying vec3 vNormalWorld;
varying vec2 vTextureCoord;
varying vec4 vTangentWorld;
varying float vDepth;

// 常量
// NUM_SAMPLES 用在 for 循环的上界和数组大小 poissonDisk[NUM_SAMPLES]。
// WebGL 1 要求循环上界和数组大小是编译期常量，uniform 不行
#define NUM_SAMPLES 50
#define NUM_RINGS 10
// #define BLOCKER_SEARCH_NUM_SAMPLES NUM_SAMPLES
// #define PCF_NUM_SAMPLES NUM_SAMPLES
// 纯数学常量，和引擎状态无关
#define EPS 1e-3
#define PI 3.141592653589793
#define PI2 6.283185307179586

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

float getShadowBias(float biasC, float filterRadiusUV) {
  // 当前片元的法线（世界空间）
  vec3 normal = normalize(vNormalWorld);

  // 从片元指向光源的方向
  vec3 lightDir = normalize(uLightPos - vPosWorld);

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

// float SimpleShadowMap(vec3 worldPos, float bias) {
//   vec4 posFromLight = uLightVP * vec4(worldPos, 1.0);
//   vec2 shadowCoord = clamp(posFromLight.xy * 0.5 + 0.5, vec2(0.0), vec2(1.0));
//   float depthSM = texture2D(uShadowMap, shadowCoord).x;
//   float depth = (posFromLight.z * 0.5 + 0.5) * 100.0;

//   return step(0.0, depthSM - depth + bias); // step(edge, x) = x >= edge ? 1.0 : 0.0
// }

// ============================================================
// Simple Shadow Map 方法 -- Deprecated
// ============================================================

float SimpleShadowMap(vec3 worldPos, float bias) {
  vec4 posFromLight = uLightVP * vec4(worldPos, 1.0);
  // vec3 shadowCoords = clamp(posFromLight.xyz / posFromLight.w * 0.5 + 0.5, 0.0, 1.0);
  vec3 shadowCoords = posFromLight.xyz / posFromLight.w * 0.5 + 0.5;
  float depthSM = 0.0;
  if (uUseDepthTexture == 1) {
    depthSM = texture2D(uShadowMap, shadowCoords.xy).r;
  } else {
    depthSM = unpack(texture2D(uShadowMap, shadowCoords.xy));
  }
  float depth = shadowCoords.z;

  return step(0.0, depthSM - depth + bias); // step(edge, x) = x >= edge ? 1.0 : 0.0
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
  return step(0.0, depth + EPS - cur_depth + bias);
}

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
float findBlocker(sampler2D shadowMap, vec2 uv, float zReceiver, float posZFromLight) {
  // uv: 当前片元在 shadow map 上的 UV 坐标
  // zReceiver: 当前片元在光源空间的深度
  // posZFromLight: 当前片元在光源空间的 z 值（clip space，未除以 w），用于计算搜索半径

  // 找到的遮挡物数量
  int blockerNum = 0;

  // 遮挡物深度累加值
  float blockDepth = 0.0;

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
float PCSS(sampler2D shadowMap, vec4 shadowCoords, float biasC, float posZFromLight) {
  // 当前片元在光源空间的深度（[0,1] 范围）
  float zReceiver = shadowCoords.z;

  // STEP 1: avgblocker depth
  // 在搜索范围内找所有遮挡物，算平均深度
  float avgBlockerDepth = findBlocker(shadowMap, shadowCoords.xy, zReceiver, posZFromLight);

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

// ============================================================
// 计算 TBN 方法
// ============================================================
// 数学方法（不一定准确）
void LocalBasis(vec3 n, out vec3 b1, out vec3 b2) {
  float sign_ = sign(n.z);
  if (n.z == 0.0) {
    sign_ = 1.0;
  }
  float a = -1.0 / (sign_ + n.z);
  float b = n.x * n.y * a;
  b1 = vec3(1.0 + sign_ * n.x * n.x * a, sign_ * b, -sign_ * n.x);
  b2 = vec3(b, sign_ + n.y * n.y * a, -n.y);
}

vec3 ApplyTangentNormalMap() {
  vec3 t, b;

  // vTangentWorld.xyz 长度 > 0 说明模型提供了 tangent 数据
  // （如果 attribute aTangent 被编译器剥离或全为零，vTangent 会是 (0,0,0,0)）
  if (length(vTangentWorld.xyz) > 0.001) {
    // -- Gram-Schmidt 正交化 --
    t = normalize(vTangentWorld.xyz);
    // 重正交化：去掉 t 中平行于 n 的分量（画个图立马就明白了）
    t = normalize(t - dot(t, vNormalWorld));
    // bitangent = cross(n, t) × handedness，vTangent.w 是 handedness（+1 或 -1），决定 bitangent 方向
    b = cross(vNormalWorld, t) * vTangentWorld.w;
  } else {
    // -- fallback：数学构造 --
    LocalBasis(vNormalWorld, t, b);
  }

  vec3 nt = texture2D(uNt, vTextureCoord).xyz * 2.0 - 1.0;
  nt = normalize(nt.x * t + nt.y * b + nt.z * vNormalWorld);
  return nt;
}

void main() {
  // ==================== GBuffer 输出 [0]: diffuse color ====================
  vec3 kd = texture2D(uKd, vTextureCoord).rgb;
  gl_FragData[0] = vec4(kd, 1.0);
  // ==================== GBuffer 输出 [1]: 线性深度 ====================
  gl_FragData[1] = vec4(vec3(vDepth), 1.0);
  // ==================== GBuffer 输出 [2]: 世界空间法线 ====================
  gl_FragData[2] = vec4(ApplyTangentNormalMap(), 1.0);
  // ==================== GBuffer 输出 [3]: 阴影可见度 ====================
  // 需要调整第二个参数 bias 的大小来满足实际的遮挡关系
  gl_FragData[3] = vec4(vec3(SimpleShadowMap(vPosWorld.xyz, 1e-3)), 1.0);
  // // 用 PCSS 替换 SimpleShadowMap
  // // 在 fragment 中计算光源空间坐标
  // vec4 posFromLight = uLightVP * vec4(vPosWorld, 1.0);
  // // 透视除法 + 映射到 [0,1]
  // vec3 shadowCoords = clamp(posFromLight.xyz / posFromLight.w * 0.5 + 0.5, 0.0, 1.0);
  // // posFromLight.z 是光源 clip space 的 z，findBlocker 的搜索半径计算需要它
  // float posZFromLight = posFromLight.z;

  // float biasC = 0.08;
  // float visibility = PCSS(uShadowMap, vec4(shadowCoords, 1.0), biasC, posZFromLight);
  // gl_FragData[3] = vec4(vec3(visibility), 1.0);
  // ==================== GBuffer 输出 [4]: 世界坐标 ====================
  gl_FragData[4] = vec4(vec3(vPosWorld.xyz), 1.0);
}
