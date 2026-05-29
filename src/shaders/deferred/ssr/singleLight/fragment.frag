#ifdef GL_ES
precision highp float;
#endif

// ==================== Uniform：GBuffer 纹理 ====================

// 这 5 张纹理对应 GBufferFBO 的 5 个 color attachment
// SSR Pass 从这些纹理"读取"场景信息，而不是从 mesh 获取
uniform sampler2D uGDiffuse; // [0] 漫反射颜色（Kd）
uniform sampler2D uGDepth; // [1] 线性深度（gl_Position.w）
uniform sampler2D uGNormalWorld; // [2] 世界空间法线
uniform sampler2D uGShadow; // [3] 阴影可见度（0 或 1）
uniform sampler2D uGPosWorld; // [4] 世界坐标

// ==================== Uniform：相机 & 光照 ====================

// uniform vec3 uLightDir;
// uniform vec3 uCameraPos;
// uniform vec3 uLightRadiance;

// VP 矩阵：世界坐标 → clip space
// 旧版用 varying mat4 vWorldToScreen 传，现在用 uniform
// 用途：RayMarch 中把世界坐标投影到屏幕空间来查 depth buffer
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

// 相机位置：计算 wo = normalize(cameraPos - worldPos)
// wo 是"从表面点指向相机的方向"，BRDF 中的出射方向
uniform vec3 uCameraPos;

// 光照方向（从表面点指向光源的方向）
// 注意这里是 shading direction（wi），不是 light travel direction
uniform vec3 uLightDir;

// 光照辐射度（RGB）：直接光照强度
uniform vec3 uLightRadiance;

// ==================== Varying：从 vertex shader 传来 ====================

// 屏幕 UV [0,1]×[0,1]
// 每个 fragment 对应屏幕上一个像素，这个 UV 就是该像素在 GBuffer 纹理中的采样坐标
varying vec2 vScreenUV;
// varying mat4 vWorldToScreen;
// varying highp vec4 vPosWorld;

// ==================== 常量 ====================

#define M_PI 3.1415926535897932384626433832795
#define TWO_PI 6.283185307
#define INV_PI 0.31830988618
#define INV_TWO_PI 0.15915494309

// ==================== 随机数生成（用于 Monte Carlo 采样） ====================

// 单变量哈希随机数
// p 是状态变量（inout），每次调用后被修改，产生伪随机序列
float Rand1(inout float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

// 生成 2D 随机向量
vec2 Rand2(inout float p) {
  return vec2(Rand1(p), Rand1(p));
}

// 用像素坐标初始化随机种子
// gl_FragCoord.xy 是当前 fragment 的像素坐标（如 (512.5, 384.5)）
// 不同像素有不同种子 → 不同的随机序列 → 避免采样模式整齐导致的 artifact
float InitRand(vec2 uv) {
  vec3 p3 = fract(vec3(uv.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// ==================== 半球采样（间接光照用） ====================

// 余弦加权半球采样（Cosine-weighted hemisphere sampling）
//
// 为什么用余弦加权而不是均匀采样？
// Lambert BRDF 中有 cos(θ) 项，如果用均匀采样，
// 靠近法线的方向贡献大但采样少，浪费 sample。
// 余弦加权让靠近法线方向的采样概率更高，方差更小。
//
// 返回值：局部坐标系下的方向（z 轴 = 法线方向）
// pdf：该方向的概率密度 = cos(θ) / π
vec3 SampleHemisphereUniform(inout float s, out float pdf) {
  vec2 uv = Rand2(s);
  float z = uv.x;
  float phi = uv.y * TWO_PI;
  float sinTheta = sqrt(1.0 - z * z);
  vec3 dir = vec3(sinTheta * cos(phi), sinTheta * sin(phi), z);
  pdf = INV_TWO_PI;
  return dir;
}

vec3 SampleHemisphereCos(inout float s, out float pdf) {
  vec2 uv = Rand2(s);
  float z = sqrt(1.0 - uv.x);
  float phi = uv.y * TWO_PI;
  float sinTheta = sqrt(uv.x);
  vec3 dir = vec3(sinTheta * cos(phi), sinTheta * sin(phi), z);
  pdf = z * INV_PI;
  return dir;
}

// ==================== LocalBasis：从法线构建 TBN ====================

// 和 GBuffer fragment shader 中的 LocalBasis 一样
// SSR 的间接光照需要把局部坐标系下的随机方向转到世界坐标系
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

// ==================== 坐标变换工具函数 ====================

// 获取世界坐标点在相机空间中的线性深度
//
// 旧版：(vWorldToScreen * vec4(posWorld, 1.0)).w
// 新版：用 uniform 矩阵代替 varying 矩阵
//
// 为什么取 .w？
// clip = Projection × View × worldPos
// 对于透视投影，clip.w = -z_eye（相机空间的 z 取反）
// 这就是线性深度 —— 和 GBuffer 中存的 gl_Position.w 一致
// float GetDepth(vec3 posWorld) {
//   float depth = (vWorldToScreen * vec4(posWorld, 1.0)).w;
//   return depth;
// }
float GetDepth(vec3 posWorld) {
  float depth = (uProjectionMatrix * uViewMatrix * vec4(posWorld, 1.0)).w;
  return depth;
}

/*
 * Transform point from world space to screen space([0, 1] x [0, 1])
 */
vec2 GetScreenUV(vec3 posWorld) {
  vec4 clip = uProjectionMatrix * uViewMatrix * vec4(posWorld, 1.0);
  vec4 ndc = clip / clip.w;
  vec2 uv = clamp(ndc.xy * 0.5 + 0.5, 0.0, 1.0);
  return uv;
}

float GetGBufferDepth(vec2 uv) {
  float depth = texture2D(uGDepth, uv).x;
  if (depth < 1e-2) {
    depth = 1000.0;
  }
  return depth;
}

vec3 GetGBufferNormalWorld(vec2 uv) {
  vec3 normal = texture2D(uGNormalWorld, uv).xyz;
  return normal;
}

vec3 GetGBufferPosWorld(vec2 uv) {
  vec3 posWorld = texture2D(uGPosWorld, uv).xyz;
  return posWorld;
}

float GetGBufferuShadow(vec2 uv) {
  float visibility = texture2D(uGShadow, uv).x;
  return visibility;
}

vec3 GetGBufferDiffuse(vec2 uv) {
  vec3 diffuse = texture2D(uGDiffuse, uv).xyz;
  diffuse = pow(diffuse, vec3(2.2));
  return diffuse;
}

/**
 * 计算 Lambert 漫反射（BRDF * cosθ）。
 *
 * @param wi - 入射光方向（世界空间，已归一化）
 * @param wo - 出射/视线方向（世界空间，已归一化）（该漫反射模型用不着）
 * @param uv - 屏幕 UV，用于从 GBuffer 取数据
 * @returns 漫反射贡献 = albedo / π * max(dot(n, wi), 0)
 *
 * 注意：
 * - 已包含余弦项 cosθ（n · wi）
 * - 不包含光源辐射度（Li）
 */
vec3 EvalDiffuse(vec3 wi, vec3 wo, vec2 uv) {
  vec3 L = vec3(0.0);
  vec3 albedo = GetGBufferDiffuse(uv);
  vec3 normal = GetGBufferNormalWorld(uv);
  float cosine = max(0.0, dot(normal, wi));
  L = albedo * INV_PI * cosine;

  return L;
}

/**
 * 计算方向光的入射辐射度（Li），包含阴影。
 *
 * @param uv - 屏幕 UV，用于获取阴影可见性
 * @returns 入射光强 = lightRadiance * visibility
 *
 * 注意：
 * - visibility ∈ [0,1]（来自 shadow map）
 * - 不包含 BRDF 或余弦项
 */
vec3 EvalDirectionalLight(vec2 uv) {
  vec3 Le = vec3(0.0);
  float visibility = GetGBufferuShadow(uv);
  Le = uLightRadiance * visibility;

  return Le;
}

bool RayMarch(vec3 ori, vec3 dir, out vec3 hitPos) {
  // 需要调整步进大小来平衡帧数和计算精度 -- 步进越小，计算开销越大，但计算精度更好
  // float step = 0.05;
  float step = 0.1;
  // 需要调整步进次数来平衡帧数和效果 -- 步进次数越大，计算开销越大，但效果可能更好
  const int totalStepCount = 100;

  vec3 curPos = ori;

  for (int stepCount = 0; stepCount < totalStepCount; stepCount++) {
    vec2 screenUV = GetScreenUV(curPos);
    float rayDepth = GetDepth(curPos);
    float gBufferDepth = GetGBufferDepth(screenUV);

    if (rayDepth - gBufferDepth > 0.0001) {
      hitPos = curPos;
      return true;
    }

    curPos += normalize(dir) * step;
  }

  return false;
}

// test Screen Space Ray Tracing
vec3 EvalReflect(vec3 wi, vec3 wo, vec2 screenUV) {
  vec3 normal = GetGBufferNormalWorld(screenUV);
  vec3 reflectDir = normalize(reflect(-wo, normal));
  vec3 hitPos;

  if (RayMarch(GetGBufferPosWorld(screenUV), reflectDir, hitPos)) {
    vec2 screenUV = GetScreenUV(hitPos);
    return GetGBufferDiffuse(screenUV);
  } else {
    return vec3(0.0);
  }
}

// 需要调整采样数量来平衡帧数和渲染效果 -- 采样数量越大，计算开销越大，但最终呈现的效果可能更好
#define SAMPLE_NUM 6

void main() {
  float s = InitRand(gl_FragCoord.xy);

  vec3 L = vec3(0.0);

  // vec3 worldPos = vPosWorld.xyz;
  vec3 worldPos = GetGBufferPosWorld(vScreenUV);
  // vec2 screenUV = GetScreenUV(worldPos);
  vec2 screenUV = vScreenUV;
  vec3 wi = normalize(uLightDir);
  vec3 wo = normalize(uCameraPos - worldPos);

  // 如果要切换 cave 和 cube 模型，需要在 engine.js 中切换 光源 和 相机 参数
  // 直接光照
  L = EvalDiffuse(wi, wo, screenUV) * EvalDirectionalLight(screenUV);

  // Screen Space Ray Tracing 的反射测试
  // L = (GetGBufferDiffuse(screenUV) + EvalReflect(wi, wo, screenUV)) / 2.;

  // 间接光照
  vec3 L_indirect = vec3(0.0);
  for (int i = 0; i < SAMPLE_NUM; i++) {
    float pdf;
    vec3 localDir = SampleHemisphereCos(s, pdf);
    vec3 normal = GetGBufferNormalWorld(screenUV);
    vec3 b1, b2;
    LocalBasis(normal, b1, b2);
    vec3 dir = normalize(mat3(b1, b2, normal) * localDir);

    vec3 hitPos;
    if (RayMarch(worldPos, dir, hitPos)) {
      vec2 hitScreenUV = GetScreenUV(hitPos);
      L_indirect +=
        EvalDiffuse(dir, wo, screenUV) / pdf * EvalDiffuse(wi, -dir, hitScreenUV) * EvalDirectionalLight(hitScreenUV);
    }
  }

  L_indirect /= float(SAMPLE_NUM);

  L += L_indirect;

  vec3 color = pow(clamp(L, vec3(0.0), vec3(1.0)), vec3(1.0 / 2.2));
  gl_FragColor = vec4(vec3(color.rgb), 1.0);

  // 1. 漫反射颜色（GBuffer 是否正确存了 albedo？）
  // gl_FragColor = vec4(GetGBufferDiffuse(vScreenUV), 1.0);

  // 2. 世界法线（应该看到彩色的法线图，R=x G=y B=z）
  // gl_FragColor = vec4(GetGBufferNormalWorld(vScreenUV) * 0.5 + 0.5, 1.0);

  // 3. 阴影可见度（白=光照区，黑=阴影区，应该有软边）
  // gl_FragColor = vec4(vec3(GetGBufferuShadow(vScreenUV)), 1.0);

  // 4. 世界坐标（应该看到有空间变化的颜色）
  // gl_FragColor = vec4(abs(GetGBufferPosWorld(vScreenUV)) * 0.1, 1.0);

  // 5. 线性深度
  // gl_FragColor = vec4(vec3(GetGBufferDepth(vScreenUV) * 0.01), 1.0);

  // 6. 只看直接光照（不含间接）
  // gl_FragColor = vec4(pow(clamp(L, vec3(0.0), vec3(1.0)), vec3(1.0 / 2.2)), 1.0);

  // 7. 只看间接光照（放大 10 倍，因为可能很暗）
  // gl_FragColor = vec4(pow(clamp(L_indirect * 10.0, vec3(0.0), vec3(1.0)), vec3(1.0 / 2.2)), 1.0);

}
