#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D uInputTexture;
uniform int uSubtransformSize; // 当前子变换大小: 2, 4, 8, 16, ...
uniform int uTransformSize; // 总FFT大小 (N)
uniform int uInverse; // 0=正变换, 1=逆变换

varying vec2 vTexCoord;

#define M_PI 3.1415926535897932384626433832795
#define TWO_PI 6.283185307

// 复数乘法
vec2 complexMul(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

void main() {
  // 1. 根据纹理坐标计算当前像素对应的输出索引
  // 这里假设是一维FFT，数据存储为 (N x 1) 的纹理
  float outputIndex = vTexCoord.x * float(uTransformSize) - 0.5;

  // 2. Stockham 算法的关键：计算输入的 even/odd 索引
  // evenIndex = floor(outputIndex / subtransformSize) * (subtransformSize / 2)
  //           + mod(outputIndex, subtransformSize / 2)
  float halfSubSize = float(uSubtransformSize) * 0.5;
  float evenIndex = floor(outputIndex / float(uSubtransformSize)) * halfSubSize + mod(outputIndex, halfSubSize);

  // 3. 从输入纹理读取 even 和 odd 样本
  // even 样本位于前半部分
  float evenU = (evenIndex + 0.5) / float(uTransformSize);
  vec2 even = texture2D(uInputTexture, vec2(evenU, 0.5)).rg;

  // odd 样本位于后半部分（偏移 transformSize/2）
  float oddIndex = evenIndex + float(uTransformSize) * 0.5;
  float oddU = (oddIndex + 0.5) / float(uTransformSize);
  vec2 odd = texture2D(uInputTexture, vec2(oddU, 0.5)).rg;

  // 4. 计算旋转因子 (twiddle factor)
  // W_N^k = e^(-2πi*k/N) 其中 k = outputIndex / subtransformSize
  float sign = uInverse == 1 ? 1.0 : -1.0;
  float twiddleArgument = sign * TWO_PI * (outputIndex / float(uSubtransformSize));
  vec2 twiddle = vec2(cos(twiddleArgument), sin(twiddleArgument));

  // 5. 蝶形运算: output = even + twiddle * odd
  vec2 result = even + complexMul(twiddle, odd);

  gl_FragColor = vec4(result.x, result.y, 0.0, 1.0);
}
