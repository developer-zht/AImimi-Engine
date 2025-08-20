// FFTOceanFragment.glsl
#ifdef GL_ES
precision highp float;
#endif

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vTexCoord;
varying float vFoam;

uniform vec3 uCameraPos;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;

uniform sampler2D uDisplacementMap;
uniform sampler2D uNormalMap;

uniform vec3 uDeepWaterColor;
uniform vec3 uShallowWaterColor;
uniform float uFresnelPower;
uniform float uSpecularPower;
uniform float uSpecularStrength;
uniform float uFoamThreshold;

// 菲涅尔效应
float fresnel(vec3 normal, vec3 viewDir) {
  return pow(1.0 - max(dot(normal, viewDir), 0.0), uFresnelPower);
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCameraPos - vWorldPosition);
  vec3 L = normalize(uLightDir);
  vec3 H = normalize(L + V);

  // 基础光照
  float NdotL = max(dot(N, L), 0.0);
  float NdotH = max(dot(N, H), 0.0);

  // 漫反射
  vec3 diffuse = NdotL * uLightColor;

  // 镜面反射
  float specular = pow(NdotH, uSpecularPower) * uSpecularStrength;

  // 菲涅尔
  float F = fresnel(N, V);

  // 水体颜色
  vec3 waterColor = mix(uShallowWaterColor, uDeepWaterColor, F);

  // 合成颜色
  vec3 color = uAmbientColor + waterColor * diffuse + specular * uLightColor;

  // 泡沫
  float foam = smoothstep(uFoamThreshold, 1.0, 1.0 - vFoam);
  color = mix(color, vec3(1.0), foam);

  gl_FragColor = vec4(color, 1.0);
  // gl_FragColor = vec4(vec3(texture2D(uDisplacementMap, vTexCoord).y), 1.0);
  // gl_FragColor = vec4(vec3(0.6, 0.3, 0.1), 1.0);
}
