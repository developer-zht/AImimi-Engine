#ifdef GL_ES
precision highp float;
#endif

varying vec3 vTexCoord; // 代表3D纹理坐标的方向向量

uniform samplerCube uSkyboxMap;
uniform int uIsHDR; // 1 = 线性 HDR, 0 = sRGB LDR
uniform float uExposure; // 曝光（默认 1.0）

// 替换 skybox/fragment.frag 里的 Reinhard

// ACES Filmic Tone Mapping（Krzysztof Narkowicz 简化版）
vec3 ACESFilm(vec3 x) {
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;
  return clamp(x * (a * x + b) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec3 color = textureCube(uSkyboxMap, vTexCoord).rgb;

  // 1. 输入解码到线性空间
  if (uIsHDR == 0) {
    // LDR PNG/JPG：sRGB 编码 → 线性
    color = pow(color, vec3(2.2));
  }

  // 2. 曝光
  color *= uExposure;

  // 3. Tone Mapping (Reinhard)
  if (uIsHDR == 1) {
    // color = color / (color + vec3(1.0)); // Reinhard 把 [0,∞) 压到 [0,1)
    color = ACESFilm(color); // 比 Reinhard 保留更多对比和饱和度
  } else {
    color = clamp(color, 0.0, 1.0); // LDR 仅做安全 clamp（防止 exposure > 1 过曝）
  }

  // 4. 线性 → sRGB
  color = pow(color, vec3(1.0 / 2.2));

  gl_FragColor = vec4(color, 1.0);
}
