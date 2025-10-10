// FFTOceanFragment.glsl
#ifdef GL_ES
precision highp float;
#endif

// 从 Vertex shader 传入的 Fragment varying
varying vec4 vWorldPosition;
varying vec2 vTexCoord;
varying vec3 vNormal;
varying float vWaveHeight;
varying float vWaterDepth;
varying float vFoam; // 传递泡沫因子（雅可比值）

uniform float uGeometrySize; // 海面网格 mesh 的大小
uniform float uTextureSize; // texture 的大小（实则是 spectrum 的分辨率）
// varying vec4 vOriginalWorldPosition;

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
  // ========== 1. UV计算 ==========
  vec2 uv = vWorldPosition.xz / uGeometrySize + 0.5;
  // uv = vTexCoord;

  // float baseScale = 0.002; // 粗糙层：每500m重复
  // float detailScale = 0.008; // 细节层：每125m重复
  // vec2 coord1 = vWorldPosition.xz * baseScale;
  // vec2 coord2 = vWorldPosition.xz * detailScale;
  // uv = coord1;
  // ========== 2. 采样贴图 ==========
  vec3 displacement = texture2D(uDisplacementMap, uv).xyz;

  vec2 slope = texture2D(uGradientMap, uv).xy;
  // vec2 slope1 = texture2D(uGradientMap, vWorldPosition.xz * 0.002).xy;
  // vec2 slope2 = texture2D(uGradientMap, vWorldPosition.xz * 0.008).xy * 0.5;
  // slope = slope1 + slope2;

  vec4 jacobianData = texture2D(uDispDerivativeMap, uv);
  float dDx_dx = jacobianData.r;
  float dDz_dz = jacobianData.g;
  float dDx_dz = jacobianData.b;
  float dDz_dx = jacobianData.a;
  float jacobian = (1.0 + dDx_dx) * (1.0 + dDz_dz) - dDx_dz * dDz_dx;
  // ========== 3. 构造法线 ==========
  // 方法一: 切线算法线
  vec3 tangentX = vec3(1.0 + dDx_dx, slope.x, dDz_dx);
  vec3 tangentZ = vec3(dDx_dz, slope.y, 1.0 + dDz_dz);
  vec3 normal = normalize(cross(tangentZ, tangentX));
  // 方法二: 梯度算法线
  vec2 gradient = vec2(slope.x / (1.0 + dDx_dx), slope.y / (1.0 + dDz_dz));
  normal = normalize(vec3(-gradient.x, 1.0, -gradient.y));
  // 方法三: 梯度 + 雅克比值算法线
  normal = normalize(
    vec3(
      -gradient.x * (1.0 + dDz_dz) + gradient.y * dDz_dx,
      jacobian,
      -gradient.y * (1.0 + dDx_dx) + gradient.x * dDx_dz
    )
  );
  // 方法四: 使用从 vertex shader 中传递过来的 vNormal
  // normal = vNormal;
  // normal *= 500.0;
  // 查看梯度
  // gl_FragColor = vec4(0.0, slope, 1.0);
  // gl_FragColor = vec4(0.0, gradient, 1.0);
  gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);

  // float height = displacement.y * 100.0;
  // if (height > 0.0) {
  //   gl_FragColor = vec4(0.0, height, 0.0, 1.0); // 正值：绿色
  // } else {
  //   gl_FragColor = vec4(-height, 0.0, 0.0, 1.0); // 负值：红色
  // }

  // 可视化雅可比（红色 = 折叠区域）
  // if (jacobian < 0.0) {
  //   gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // 红色：需要泡沫的地方
  // } else if (jacobian < 1.0) {
  //   gl_FragColor = vec4(0.0, jacobian, 0.0, 1.0); // 绿色：网格被压缩（波峰）
  // } else {
  //   gl_FragColor = vec4(0.0, 0.0, jacobian, 1.0); // 蓝色：网格被拉伸（波谷）
  // }

  vec3 color;
  if (jacobian < 0.0) {
    color = vec3(1.0, 0.0, 0.0); // 红色：折叠！
  } else if (jacobian < 0.5) {
    color = vec3(1.0, 1.0, 0.0); // 黄色：即将折叠
  } else if (jacobian < 1.0) {
    color = vec3(0.0, 1.0, 0.0); // 绿色：压缩
  } else if (jacobian < 1.5) {
    color = vec3(0.0, 1.0, 1.0); // 青色：拉伸
  } else {
    color = vec3(0.0, 0.0, 1.0); // 蓝色：过度拉伸
  }
  gl_FragColor = vec4(color, 1.0);

  // gl_FragColor = vec4(displacement * 100.0, 1.0);
  // gl_FragColor = vec4(dDx_dx, dDx_dz, dDz_dx, dDz_dz);
  // gl_FragColor = vec4(0.3, 0.3, 0.5, 1.0);
  return;

  // 直接在 Fragment Shader 中计算法线

  // float jacobian = (1.0 + dDx_dx) * (1.0 + dDz_dz) - dDx_dz * dDz_dx;

  // normal = calculateCompleteWaterNormal(normal, vWorldPosition.xz, time);

  // 计算视线方向
  vec3 viewDir = normalize(uCameraPos - vWorldPosition.xyz);

  // 计算光照方向
  vec3 lightDir = normalize(uLightDir); // 外部已经计算好（反向）太阳光（平行光）的方向了

  // 计算半程向量
  vec3 halfwayDir = normalize(lightDir + viewDir);

  // 反射方向
  vec3 reflectDir = reflect(-viewDir, normal);

  gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
}

