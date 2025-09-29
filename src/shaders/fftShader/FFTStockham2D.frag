#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D uInputTexture;
uniform int uSubtransformSize;
uniform int uTransformSize;
uniform int uInverse;
uniform int uDirection; // 0=水平, 1=垂直

varying vec2 vTexCoord;

#define M_PI 3.1415926535897932384626433832795
#define TWO_PI 6.283185307

vec2 complexMul(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

void main() {
  // 1. 根据方向确定当前索引
  float outputIndex;
  if (uDirection == 0) {
    // 水平方向：处理当前行
    outputIndex = vTexCoord.x * float(uTransformSize) - 0.5;
  } else {
    // 垂直方向：处理当前列
    outputIndex = vTexCoord.y * float(uTransformSize) - 0.5;
  }

  // 2. 计算 even/odd 索引（Stockham 重排）
  float halfSubSize = float(uSubtransformSize) * 0.5;
  float evenIndex = floor(outputIndex / float(uSubtransformSize)) * halfSubSize + mod(outputIndex, halfSubSize);

  // 3. 读取 even 和 odd 样本
  vec2 even, odd;

  if (uDirection == 0) {
    // 水平FFT: 沿x轴读取
    float evenU = (evenIndex + 0.5) / float(uTransformSize);
    float oddU = (evenIndex + float(uTransformSize) * 0.5 + 0.5) / float(uTransformSize);

    even = texture2D(uInputTexture, vec2(evenU, vTexCoord.y)).rg;
    odd = texture2D(uInputTexture, vec2(oddU, vTexCoord.y)).rg;
  } else {
    // 垂直FFT: 沿y轴读取
    float evenV = (evenIndex + 0.5) / float(uTransformSize);
    float oddV = (evenIndex + float(uTransformSize) * 0.5 + 0.5) / float(uTransformSize);

    even = texture2D(uInputTexture, vec2(vTexCoord.x, evenV)).rg;
    odd = texture2D(uInputTexture, vec2(vTexCoord.x, oddV)).rg;
  }

  // 4. 计算旋转因子
  float sign = uInverse == 1 ? 1.0 : -1.0;
  float twiddleArgument = sign * TWO_PI * (outputIndex / float(uSubtransformSize));
  vec2 twiddle = vec2(cos(twiddleArgument), sin(twiddleArgument));

  // 5. 蝶形运算
  vec2 result = even + complexMul(twiddle, odd);

  gl_FragColor = vec4(result.x, result.y, 0.0, 1.0);
}
