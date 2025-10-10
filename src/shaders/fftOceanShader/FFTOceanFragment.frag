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

uniform float uGeometrySize; // 海面网格 mesh 的大小
uniform float uTextureSize; // texture 的大小（实则是 spectrum 的分辨率）
varying vec4 vOriginalWorldPosition;

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

uniform sampler2D uDisplacementMap; // IFFT 生成的位移贴图
uniform sampler2D uGradientMap; // IFFT 生成的梯度贴图
uniform sampler2D uDispDerivativeMap; // IFFT 生成的位移导数贴图

void main() {
  vec2 uv = vOriginalWorldPosition.xz / uGeometrySize + 0.5;
  uv = vTexCoord;

  float baseScale = 0.002; // 粗糙层：每500m重复
  float detailScale = 0.008; // 细节层：每125m重复
  vec2 coord1 = vOriginalWorldPosition.xz * baseScale;
  vec2 coord2 = vOriginalWorldPosition.xz * detailScale;
  // ========== 1. UV计算 ==========
  // uv = coord1;
  // ========== 2. 采样贴图 ==========
  vec3 displacement = texture2D(uDisplacementMap, uv).xyz;
  vec2 gradient = texture2D(uGradientMap, uv).xy;
  vec4 jacobianData = texture2D(uDispDerivativeMap, uv);
  float dDx_dx = jacobianData.r;
  float dDz_dz = jacobianData.g;
  float dDx_dz = jacobianData.b;
  float dDz_dx = jacobianData.a;
  // ========== 3. 构造切线和法线 ==========
  vec3 tangentX = vec3(1.0 + dDx_dx, gradient.x, dDz_dx);
  vec3 tangentZ = vec3(dDx_dz, gradient.y, 1.0 + dDz_dz);
  vec3 normal = normalize(cross(tangentZ, tangentX));
  // gl_FragColor = vec4(0.0, gradient, 1.0);
  // 查看梯度
  // gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);
  // gl_FragColor = vec4(displacement, 1.0);
  // gl_FragColor = vec4(vec3(displacement.y), 1.0);
  float height = displacement.y * 100.0;
  // if (height > 0.0) {
  //   gl_FragColor = vec4(0.0, height, 0.0, 1.0); // 正值：绿色
  // } else {
  //   gl_FragColor = vec4(-height, 0.0, 0.0, 1.0); // 负值：红色
  // }
  // gl_FragColor = vec4(0.0, displacement.y * 100.0, 0.0, 1.0);
  // gl_FragColor = vec4(displacement * 100.0, 1.0);
  // gl_FragColor = vec4(dDx_dx, dDx_dz, dDz_dx, dDz_dz);
  gl_FragColor = vec4(0.3, 0.3, 0.5, 1.0);
  return;

  // 直接在 Fragment Shader 中计算法线
  vec2 gradient1 = texture2D(uGradientMap, vWorldPosition.xz * 0.002).xy;
  vec2 gradient2 = texture2D(uGradientMap, vWorldPosition.xz * 0.008).xy * 0.5;
  gradient = gradient1 + gradient2;
  // gl_FragColor = vec4(gradient.x, gradient.y, 0.0, 1.0);
  // gl_FragColor = vec4(gradient.x * 0.5 + 0.5, gradient.y * 0.5 + 0.5, 0.0, 1.0);
  float jacobian = (1.0 + dDx_dx) * (1.0 + dDz_dz) - dDx_dz * dDz_dx;

  // 归一化法线
  vec3 N = normalize(
    vec3(
      -gradient.x * (1.0 + dDz_dz) + gradient.y * dDz_dx,
      jacobian, // 不是固定的 1.0
      -gradient.y * (1.0 + dDx_dx) + gradient.x * dDx_dz
    )
  );
  // normal = calculateCompleteWaterNormal(normal, vWorldPosition.xz, time);

  // 计算视线方向
  vec3 viewDir = normalize(uCameraPos - vWorldPosition);

  // 计算光照方向
  vec3 lightDir = normalize(uLightDir); // 外部已经计算好（反向）太阳光（平行光）的方向了

  // 计算半程向量
  vec3 halfwayDir = normalize(lightDir + viewDir);

  // 反射方向
  vec3 reflectDir = reflect(-viewDir, normal);

  gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
}

