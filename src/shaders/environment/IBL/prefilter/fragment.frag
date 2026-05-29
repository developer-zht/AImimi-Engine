#ifdef GL_ES
precision highp float;
#endif

// =====================================================================
// GGX-importance-sampled environment prefilter
// Karis 2013, "Real Shading in Unreal Engine 4"
//
// 把原 envmap 卷积成"按 roughness 分 mip"的 prefiltered cubemap。
// 对当前 cubemap face 用 fragment 对应的方向 N（= R = V，Karis 近似），
// 用 GGX 重要性采样在半球面上对 envmap 加权积分。
// 输出像素 = Σ envmap(L) · NdotL / Σ NdotL
// =====================================================================

uniform samplerCube uSrcCubemap;
uniform float uRoughness; // 当前 mip 对应的 roughness ∈ [0, 1]
uniform int uSampleCount; // GGX 重要性采样次数
uniform float uFireflyClamp; // HDR 单像素亮度上限；-1 = 禁用；推荐 20（晴天）/40（弱光场景）

varying vec3 vWorldPosition;

const float PI = 3.14159265359;

// van der Corput radical inverse in base 2，用浮点模拟（WebGL 1 无 bit op）
float radicalInverseVdC(float i) {
  float result = 0.0;
  float denom = 1.0;
  float n = i;
  for (int bit = 0; bit < 16; bit++) {
    denom *= 2.0;
    float bitVal = mod(n, 2.0);
    result += bitVal / denom;
    n = floor(n / 2.0);
    if (n < 1.0) break;
  }
  return result;
}

vec2 hammersley(float i, float N) {
  return vec2(i / N, radicalInverseVdC(i));
}

vec3 importanceSampleGGX(vec2 Xi, vec3 N, float roughness) {
  float a = roughness * roughness;

  float phi = 2.0 * PI * Xi.x;
  // GGX PDF 反演：cos²θ = (1 - ξ) / (1 + (a² - 1)·ξ)
  float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a * a - 1.0) * Xi.y));
  float sinTheta = sqrt(1.0 - cosTheta * cosTheta);

  vec3 Hlocal;
  Hlocal.x = cos(phi) * sinTheta;
  Hlocal.y = sin(phi) * sinTheta;
  Hlocal.z = cosTheta;

  // 以 N 为 z 轴构造正交基
  vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = normalize(cross(up, N));
  vec3 bitangent = cross(N, tangent);

  return normalize(tangent * Hlocal.x + bitangent * Hlocal.y + N * Hlocal.z);
}

void main() {
  vec3 N = normalize(vWorldPosition);
  vec3 R = N;
  vec3 V = R;

  vec3 prefilteredColor = vec3(0.0);
  float totalWeight = 0.0;

  const int MAX_SAMPLES = 1024;
  float fSampleCount = float(uSampleCount);

  for (int i = 0; i < MAX_SAMPLES; i++) {
    if (i >= uSampleCount) break;

    vec2 Xi = hammersley(float(i), fSampleCount);
    vec3 H = importanceSampleGGX(Xi, N, uRoughness);
    vec3 L = normalize(2.0 * dot(V, H) * H - V);

    float NdotL = max(dot(N, L), 0.0);
    if (NdotL > 0.0) {
      // prefilteredColor += textureCube(uSrcCubemap, L).rgb * NdotL;
      vec3 sampleColor = textureCube(uSrcCubemap, L).rgb;
      if (uFireflyClamp > 0.0) {
        sampleColor = min(sampleColor, vec3(uFireflyClamp));
      }
      prefilteredColor += sampleColor * NdotL;
      totalWeight += NdotL;
    }
  }

  prefilteredColor = prefilteredColor / max(totalWeight, 1e-4);
  gl_FragColor = vec4(prefilteredColor, 1.0);
}
