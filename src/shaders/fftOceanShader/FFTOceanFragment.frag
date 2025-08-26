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
uniform float uTime;

// Textures
uniform sampler2D uDiffuseMap;
uniform sampler2D uNormalMap;
uniform samplerCube uEnvironmentMap;
uniform int uUseDiffuseMap;
uniform int uUseNormalMap;
uniform int uUseEnvironmentMap;

uniform sampler2D uDisplacementMap;

// 材质属性修正：水的真实物理参数
const float WATER_IOR = 1.33; // 水的折射率
const float AIR_IOR = 1.0; // 空气折射率
const float WATER_METALLIC = 0.02; // 水的金属度（几乎为非金属）
const float WATER_BASE_ROUGHNESS = 0.008; // 水的基础粗糙度（非常光滑）
const vec3 WATER_F0 = vec3(0.02); // 水的基础反射率

// 深度和颜色参数
const float DEPTH_ATTENUATION = 0.05; // 深度衰减系数
const float FOAM_THRESHOLD = 0.4; // 泡沫阈值

// Constant
#define M_PI 3.1415926535897932384626433832795
#define TWO_PI 6.283185307
#define INV_PI 0.31830988618
#define INV_TWO_PI 0.15915494309

void main() {
  // 时间
  float time = uTime;

  // 归一化法线
  vec3 normal = normalize(vNormal);
  // normal = calculateCompleteWaterNormal(normal, vWorldPosition.xz, time);

  // 计算视线方向
  vec3 viewDir = normalize(uCameraPos - vWorldPosition);

  // 计算光照方向
  vec3 lightDir = normalize(uLightDir); // 外部已经计算好（反向）太阳光（平行光）的方向了

  // 计算半程向量
  vec3 halfwayDir = normalize(lightDir + viewDir);

  // 反射方向
  vec3 reflectDir = reflect(-viewDir, normal);

  // 光照参数
  vec3 upwelling = vec3(0, 0.2, 0.3); // 水中上涌光线颜色（偏蓝绿）
  vec3 sky = vec3(0.69, 0.84, 1); // 天空颜色（浅蓝）
  vec3 air = vec3(0.1, 0.1, 0.1); // 空气颜色（深灰）
  float nSnell = 1.34; // 水的折射率
  float reflectivity = 0.0; // 反射率
  float Kdiffuse = 0.91;

  // costhetai = abs(dot(nI, nN)); // 入射角余弦值，nI - 入射方向向量，nN - 表面法向量
  float costhetai = abs(dot(viewDir, normal));

  float thetai = acos(costhetai); // 入射角
  float sinthetat = sin(thetai) / nSnell; // 折射角正弦（斯涅尔定律）
  float thetat = asin(sinthetat); // 折射角

  if (sinthetat > 1.0) {
    // 全反射情况
    reflectivity = 1.0;
  } else if (thetai == 0.0) {
    // 垂直入射的特殊情况
    reflectivity = (nSnell - 1.0) / (nSnell + 1.0);
    reflectivity = reflectivity * reflectivity;
  } else {
    // 一般情况：完整的菲涅尔公式
    float fs = sin(thetat - thetai) / sin(thetat + thetai);
    float ts = tan(thetat - thetai) / tan(thetat + thetai);
    reflectivity = 0.5 * (fs * fs + ts * ts);
  }

  float dist = length(uCameraPos - vWorldPosition) * Kdiffuse;
  dist = 0.2;

  vec3 color = dist * (reflectivity * sky + (1.0 - reflectivity) * upwelling) + (1.0 - dist) * air;
  color = pow(color, vec3(1.0 / 2.2));

  gl_FragColor = vec4(color, 1.0);
}
