#ifdef GL_ES
precision highp float;
#endif

// =====================================================================
// BRDF Integration LUT
// 输出 RG:
//   R = scale = ∫ (1 - (1 - VdotH)^5) · G_Vis dω
//   G = bias  = ∫ (1 - VdotH)^5 · G_Vis dω
//
// 运行时 shader：
//   vec2 envBRDF = texture2D(uBRDFLUT, vec2(NdotV, roughness)).rg;
//   vec3 iblSpec = prefilteredColor * (F₀ * envBRDF.x + envBRDF.y);
// =====================================================================

uniform int uSampleCount;

varying vec2 vTexCoord;

const float PI = 3.14159265359;

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
  float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a * a - 1.0) * Xi.y));
  float sinTheta = sqrt(1.0 - cosTheta * cosTheta);

  vec3 Hlocal;
  Hlocal.x = cos(phi) * sinTheta;
  Hlocal.y = sin(phi) * sinTheta;
  Hlocal.z = cosTheta;

  vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = normalize(cross(up, N));
  vec3 bitangent = cross(N, tangent);

  return normalize(tangent * Hlocal.x + bitangent * Hlocal.y + N * Hlocal.z);
}

// Smith G for IBL（与直接光的 k 不同：k_IBL = α² / 2）
float geometrySchlickGGX_IBL(float NdotV, float roughness) {
  float a = roughness;
  float k = a * a / 2.0;
  return NdotV / (NdotV * (1.0 - k) + k);
}

float geometrySmith_IBL(float NdotV, float NdotL, float roughness) {
  return geometrySchlickGGX_IBL(NdotV, roughness) * geometrySchlickGGX_IBL(NdotL, roughness);
}

vec2 integrateBRDF(float NdotV, float roughness) {
  vec3 V;
  V.x = sqrt(1.0 - NdotV * NdotV);
  V.y = 0.0;
  V.z = NdotV;

  vec3 N = vec3(0.0, 0.0, 1.0);

  float A = 0.0;
  float B = 0.0;

  const int MAX_SAMPLES = 1024;
  float fSampleCount = float(uSampleCount);

  for (int i = 0; i < MAX_SAMPLES; i++) {
    if (i >= uSampleCount) break;

    vec2 Xi = hammersley(float(i), fSampleCount);
    vec3 H = importanceSampleGGX(Xi, N, roughness);
    vec3 L = normalize(2.0 * dot(V, H) * H - V);

    float NdotL = max(L.z, 0.0);
    float NdotH = max(H.z, 0.0);
    float VdotH = max(dot(V, H), 0.0);

    if (NdotL > 0.0) {
      float G = geometrySmith_IBL(NdotV, NdotL, roughness);
      float G_Vis = G * VdotH / max(NdotH * NdotV, 1e-4);
      float Fc = pow(1.0 - VdotH, 5.0);

      A += (1.0 - Fc) * G_Vis;
      B += Fc * G_Vis;
    }
  }

  A /= fSampleCount;
  B /= fSampleCount;
  return vec2(A, B);
}

void main() {
  float NdotV = max(vTexCoord.x, 0.0001);
  float roughness = vTexCoord.y;
  roughness = max(roughness, 0.04); // 防止 mip 0 NaN

  vec2 result = integrateBRDF(NdotV, roughness);
  gl_FragColor = vec4(result, 0.0, 1.0);
}
