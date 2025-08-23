attribute vec3 aVertexPosition;
// attribute vec3 aNormalPosition
attribute vec2 aTextureCoord;

// MVP 矩阵
uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

// Gerstner wave 控制参数
// Gerstner wave 结构体（最多支持8个波）
struct GerstnerWave {
  vec2 direction; // 波浪传播方向
  float steepness; // 陡峭度
  float wavelength; // 波长
  float speedMultiplier; // 速度倍数
  float phase; // 相位偏移
};
uniform GerstnerWave uWaves[8];
uniform int uWaveCount; // Gerstner Wave 的个数
uniform float uTime; // t

// 水深模型参数
uniform int uDepthModel; // 深度模型类型：0=平坦, 1=坡度, 2=径向, 3=复合
uniform float uMaxDepth; // 最大深度
uniform float uMinDepth; // 最小深度（海岸线）
uniform vec2 uDepthCenter; // 深度中心点
uniform float uDepthFalloff; // 深度衰减系数

// 传入 Fragment 中的 Varying
varying vec3 vNormal;
varying vec2 vTexCoord;
varying vec3 vWorldPosition;
varying float vWaveHeight;
varying float vWaterDepth;
varying float vJacobian;

// constant variable
const float PI = 3.141592653589793;
const float TWO_PI = 6.283185307179586;
const float HALF_PI = 1.570796326794896;
const float g = 9.8;

/**
 * 计算Gerstner波的雅可比行列式
 */
float calculateJacobian(GerstnerWave wave, vec2 position, float time) {
  // [amplitude, wavelength, speed, direction]

  // 计算波数 k = 2π/λ
  float k = TWO_PI / wave.wavelength;

  // 计算波速 c = √(g/k)，g = 9.8
  float c = sqrt(g / k) * wave.speedMultiplier;

  // 归一化方向向量
  vec2 dir = normalize(wave.direction);

  // 计算振幅
  float amplitude = wave.steepness / k;

  // 计算相位
  float phase = k * dot(dir, position) - c * time + wave.phase;

  // jacobian 初始值
  // float jacobian = 1.0;

  // for (int i = 0; i < 4; i++) {
  // float phase = k * dot(dir, position) - c * time;
  // float steepness = 0.8 / (wave.steepness + 0.001);

  // // 雅可比行列式的贡献
  // float dPhaseDx = k * dir.x;
  // float dPhaseDz = k * dir.y;

  // jacobian -= steepness * amplitude * k * cos(phase);
  // }

  float cosP = cos(phase);

  // 简化公式：det ≈ 1 - steepness * cos(phase)
  float det = 1.0 - wave.steepness * cosP;

  return det;
}

/**
 * Gerstner 波函数
 * @param wave 波浪参数
 * @param pos 当前位置 (x, z)
 * @param time 当前时间
 * @return vec4(x_offset, y_offset, z_offset, normal_factor)
 */
vec3 calculateGerstnerWave(
  GerstnerWave wave,
  inout vec3 tangent,
  inout vec3 binormal,
  vec2 pos,
  float time,
  float steepnessSum
) {
  // 计算波数 k = 2π/λ
  float k = TWO_PI / wave.wavelength;

  // 计算波速 c = √(g/k)，g = 9.8
  float c = sqrt(g / k) * wave.speedMultiplier;

  // 归一化方向向量
  // vec2 dir = vec2(1.0, 1.0);
  // 替换为：
  vec2 dir = normalize(wave.direction);

  // 计算 phase = k * (p.x - wavespeed * time) * d.x + k * (p.z - wavespeed * time) * d.y;
  float phase = k * (dot(dir, pos) - c * time) + wave.phase;
  // float phase = k * (pos.x - c * time) * dir.x + k * (pos.y - c * time) * dir.y;

  // 计算振幅 A = steepness / k
  // 为了规避 a * k > 1 所产生的错误情况，使用权重的方式设置所有波的 stepness ​​​​之和不大于 1
  // float amplitude = wave.steepness / steepnessSum / k;
  float normalizedSteepness = wave.steepness / max(steepnessSum, 1.0);
  float amplitude = normalizedSteepness / k;

  // 计算三角函数值
  float cosPhase = cos(phase);
  float sinPhase = sin(phase);

  /**
 * 由于 Gerstner 波的点不能简单写成 y = h(x,z)，不再是“水面是某个函数的等高面”的情形（高度图不再存在），因此就不能直接写出 F(x,y,z) = y - h(x,z) = 0
 * 所以只能通过 计算切线 的方式来计算法向量
 * 水面为参数曲面 S(x,z) = (x + offsetX(x,z), offsetY, z + offsetZ(x,z))
 * 参数曲面在点 (x,z) 处的两个切向量为:
 * ∂S/∂x = ∂(x', y', z')/∂x  = (∂x'/∂x, ∂y'/∂x, ∂z'/∂x)
 * ∂S/∂z = ∂(x', y', z')/∂z  = (∂x'/∂z, ∂y'/∂z, ∂z'/∂z)
 * x' = x + d.x * Amplitude * cos(f);
 * y' = Amplitude * sin(f);
 * z' = z + d.y * Amplitude * cos(f);
 * ∂x'/∂x = 1 - d.x * d.x * (Amplitude * k) * sin(f) = 1 - d.x * d.x * steepness * sin(f)
 */
  float norSteepnessSinPhase = normalizedSteepness * sinPhase;
  float norSteepnessCosPhase = normalizedSteepness * cosPhase;
  // tangent += vec3(
  //   -dir.x * dir.x * wave.steepness * sinPhase,
  //   dir.x * wave.steepness * cosPhase,
  //   -dir.y * dir.x * wave.steepness * sinPhase
  // );
  // binormal += vec3(
  //   -dir.x * dir.y * wave.steepness * sinPhase,
  //   dir.y * wave.steepness * cosPhase,
  //   -dir.y * dir.y * wave.steepness * sinPhase
  // );
  tangent += vec3(
    -dir.x * dir.x * norSteepnessSinPhase,
    dir.x * norSteepnessCosPhase,
    -dir.y * dir.x * norSteepnessSinPhase
  );
  binormal += vec3(
    -dir.x * dir.y * norSteepnessSinPhase,
    dir.y * norSteepnessCosPhase,
    -dir.y * dir.y * norSteepnessSinPhase
  );

  return vec3(
    // dir 为波的传播方向的单位向量，dir.x 和 dir.y 为 dir 在 x 和 z 轴上的投影，同时也等于 cosθ 和 sinθ，θ 为 dir 与 x 轴的夹角
    dir.x * amplitude * cosPhase, // x偏移
    amplitude * sinPhase, // y偏移（高度）
    dir.y * amplitude * cosPhase // z偏移
  );
}

/**
 * 水深计算模型 （基于真实海洋地形的数学模型）
 *
 * 模型类型：
 * 0 - 平坦海底：固定深度
 * 1 - 坡度模型：线性坡度 depth = minDepth + slope * distance
 * 2 - 径向模型：以中心为最深点的径向衰减
 * 3 - 复合模型：结合多种地形特征
 */
float calculateWaterDepth(vec2 position, int depthModel) {
  // 计算相对于深度中心的位置
  vec2 relativePos = position - uDepthCenter;
  float distanceFromCenter = length(relativePos);

  if (depthModel == 0) {
    // === 模型0：平坦海底 ===
    return uMaxDepth;

  } else if (depthModel == 1) {
    // === 模型1：简单坡度模型 ===
    // 基于x坐标的线性坡度（模拟海岸线到深海的过渡）
    float normalizedX = (position.x + 400.0) / 800.0; // 归一化到[0,1]
    return mix(uMinDepth, uMaxDepth, normalizedX);

  } else if (depthModel == 2) {
    // === 模型2：径向深度模型 ===
    // 中心最深，向边缘变浅（模拟海盆或湖泊）
    float maxDistance = 400.0 * sqrt(2.0); // 对角线距离
    float normalizedDistance = clamp(distanceFromCenter / maxDistance, 0.0, 1.0);

    // 使用指数函数模拟真实的深度分布
    float depthFactor = 1.0 - pow(normalizedDistance, uDepthFalloff);
    return uMinDepth + (uMaxDepth - uMinDepth) * depthFactor;

  } else if (depthModel == 3) {
    // === 模型3：复合地形模型 ===
    // 结合坡度和径向特征，模拟真实海洋地形

    // 基础径向深度
    float maxDistance = 600.0; // 调整影响范围
    float normalizedDistance = clamp(distanceFromCenter / maxDistance, 0.0, 1.0);
    float radialDepth = uMinDepth + (uMaxDepth - uMinDepth) * (1.0 - pow(normalizedDistance, 2.0));

    // 添加方向性坡度（模拟大陆架）
    float slopeInfluence = (position.x + 400.0) / 800.0; // x方向坡度
    float slopeDepth = mix(uMinDepth * 0.5, uMaxDepth * 1.2, slopeInfluence);

    // 添加地形起伏（海底山脊、海沟）
    float ridge1 = sin(position.x * 0.008 + position.y * 0.005) * 15.0;
    float ridge2 = cos(position.y * 0.012 - position.x * 0.003) * 10.0;
    float terrain = ridge1 + ridge2;

    // 组合所有因素
    float combinedDepth = mix(radialDepth, slopeDepth, 0.3) + terrain;

    return clamp(combinedDepth, uMinDepth, uMaxDepth * 1.5);

  } else {
    // 默认返回平均深度
    return (uMinDepth + uMaxDepth) * 0.5;
  }
}

void main() {
  vec2 pos = aVertexPosition.xz;
  // 对时间进行缩放，使得波动频率更加适合
  float time = uTime / 1.0;

  vec3 displacedPosition = vec3(pos.x, 0.0, pos.y);
  vec3 tangent = vec3(1, 0, 0);
  vec3 binormal = vec3(0, 0, 1);
  vec3 normal = vec3(0, 0, 0);

  // 计算水深
  float waterDepth = calculateWaterDepth(pos, 1);

  // 为了规避 a * k > 1 所产生的错误情况，使用权重的方式设置所有波的 stepness ​​​​之和不大于 1
  float steepnessSum = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uWaveCount) break;
    steepnessSum += uWaves[i].steepness;
  }

  float jacobian = 0.0; // 设定 jacobian 的初始值
  for (int i = 0; i < 8; i++) {
    if (i >= uWaveCount) break;
    displacedPosition += calculateGerstnerWave(uWaves[i], tangent, binormal, pos, time, steepnessSum);
    jacobian += calculateJacobian(uWaves[i], pos, time / 10.0);
  }
  // 通过 binormal 和 tangent 的叉积求 normal
  normal = normalize(cross(binormal, tangent));
  // 平均 Jacobian
  jacobian /= float(uWaveCount);

  // Debug Code
  // finalPosition += calculateGerstnerWave(uWaves[0], tangent, binormal, pos, uTime);
  // if (uWaveCount > 0) {
  //   // 只使用第一个波，并限制参数
  //   float k = 1.0; // 固定的小波数
  //   float phase = k * aVertexPosition.x - uTime;
  //   float amplitude = 1.0; // 固定的小振幅

  //   finalPosition.y += amplitude * sin(phase);
  //   finalPosition.x += amplitude * 0.1 * cos(phase);
  // }

  vWorldPosition = (uModelMatrix * vec4(displacedPosition, 1.0)).xyz;
  vNormal = normal;
  vTexCoord = aTextureCoord;
  vWaveHeight = displacedPosition.y;
  vWaterDepth = waterDepth;
  vJacobian = jacobian;

  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(displacedPosition, 1.0);
}
