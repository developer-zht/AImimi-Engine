attribute vec3 aVertexPosition;

// MVP 矩阵
uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

// 正弦波控制参数
// uniform bool uEnableSineWave;
uniform float uAmplitude; // A
uniform float uWaveVector; // k
uniform float uAngularFreq; // ω
uniform float uTime; // t

/**
 * Sine 波函数
 * @param wave 波浪参数
 * @param pos 当前位置 (x, z)
 * @param time 当前时间
 * @return vec4(x_offset, y_offset, z_offset, normal_factor)
 */
float calculateHeight(vec2 pos, float time) {
  float wave = 0.0;

  // 主波浪层
  wave += sin(pos.x * uWaveVector * 2.0 + time * uAngularFreq * 2.0) * uAmplitude * 0.8;
  wave += sin(pos.y * uWaveVector * 1.5 + time * uAngularFreq * 1.5) * uAmplitude * 0.8;

  // 细节波浪层
  wave += sin(pos.x * uWaveVector * 4.0 + pos.y * uWaveVector * 2.0 + time * uAngularFreq * 3.0) * uAmplitude * 0.3;
  wave += cos(pos.x * uWaveVector * 3.0 - pos.y * uWaveVector * 2.5 + time * uAngularFreq * 2.5) * uAmplitude * 0.3;

  // 微细节层
  wave += sin(pos.x * uWaveVector * 8.0 + time * uAngularFreq * 4.0) * uAmplitude * 0.2;
  wave += cos(pos.y * uWaveVector * 6.0 + time * uAngularFreq * 3.5) * uAmplitude * 0.15;

  return wave;
}

/**
 * 通过数值微分计算正弦波的法线
 * 理论基础：梯度的几何意义 - 法线垂直于切平面
 */
// vec3 calculateSineNormal(vec2 pos, float time, float amplitude, float waveVector, float angularFreq) {
//   // 微分步长
//   float delta = 0.01;

//   /**
//  * 详见 https://www.cnblogs.com/shine-lee/p/11715033.html
//  * 水面为参数曲面 S(x,z) = (x, h(x,z), z), 其中 y = h(x,z)
//  *
//  *    参数曲面在点 (x,z) 处的两个切向量为:
//  *    ∂S/∂x = ∂(x, h(x,z), z)/∂x  = (1, ∂h/∂x, 0)
//  *    ∂S/∂z = ∂(x, h(x,z), z)/∂z  = (0, ∂h/∂z, 1)
//  *
//  *    计算偏导数（数值微分）
//  *    ∂h/∂x ≈ (h(x+δ,z) - h(x-δ,z)) / (2δ)
//  *    ∂h/∂z ≈ (h(x,z+δ) - h(x,z-δ)) / (2δ)
//  */

//   // 计算邻近四个点的高度值
//   float heightL = calculateSineWavesHeight(pos - vec2(delta, 0.0), time, amplitude, waveVector, angularFreq);
//   float heightR = calculateSineWavesHeight(pos + vec2(delta, 0.0), time, amplitude, waveVector, angularFreq);
//   float heightD = calculateSineWavesHeight(pos - vec2(0.0, delta), time, amplitude, waveVector, angularFreq);
//   float heightU = calculateSineWavesHeight(pos + vec2(0.0, delta), time, amplitude, waveVector, angularFreq);

//   /**
//  * 正弦波等高度图形式的波中，水面方程严格遵守 y = h(x,z)，因此可以写出水面的隐式函数：F(x,y,z) = y - h(x,z) = 0
//  * 等高面的梯度： ∇F = (∂F/∂x, ∂F/∂y, ∂F/∂z) = (-∂h/∂x, 1, -∂h/∂z)
//  * 等高面梯度垂直于等高面（等高线梯度垂直于等高线） n = ∇F = (-∂h/∂x, 1, -∂h/∂z)
//  * 表面的切向量（用来验证法线）tangent_x = (1, ∂h/∂x, 0) & tangent_z = (0, ∂h/∂z, 1)
//  */
//   float gradFx = -(heightR - heightL) / (2.0 * delta);
//   float gradFz = -(heightU - heightD) / (2.0 * delta);
//   vec3 normal = normalize(vec3(gradFx, 1, gradFz));

//   return normal;
// }

void main() {
  vec3 pos = aVertexPosition;
  float time = uTime;

  // 计算正弦波高度
  pos.y = calculateHeight(pos.xz, time);

  // 计算法线
  // vec3 normal = calculateSineNormal(pos, time, uAmplitude, uWaveVector, uAngularFreq);

  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(pos, 1.0);
}
