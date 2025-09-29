precision highp float;

uniform sampler2D uInputTexture; // 输入纹理（存储复数：R=实部, G=虚部）
uniform int uStage; // 当前 stage (0 到 log2(size)-1)
uniform int uSize; // FFT 大小
uniform bool uInverse; // 是否逆变换

varying vec2 vUV;

const float PI = 3.14159265359;

// 复数乘法：(a.x + i*a.y) * (b.x + i*b.y)
vec2 complexMul(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

// 计算旋转因子 Wnk = e^(sign*2πi*k/n)
vec2 calculateWnk(int n, int k, bool inverse) {
  float sign = inverse ? 1.0 : -1.0;
  float angle = sign * 2.0 * PI * float(k) / float(n);
  return vec2(cos(angle), sin(angle));
}

void main() {
  // 将 UV 坐标映射回索引
  int index = int(vUV.x * float(uSize));

  // 计算当前 stage 的参数
  int n = int(pow(2.0, float(uStage + 1))); // 蝶形网络大小
  int interval = int(pow(2.0, float(uStage))); // 上下端点间隔
  int k = index - index / n * n; // 频率索引 int k = index % n;

  // 确定蝶形运算的上下端点索引
  int upIndex, downIndex;
  if (index - index / n * n < interval) {
    upIndex = index;
    downIndex = index + interval;
  } else {
    upIndex = index - interval;
    downIndex = index;
  }

  // 从纹理读取复数数据
  float texCoordUp = (float(upIndex) + 0.5) / float(uSize);
  float texCoordDown = (float(downIndex) + 0.5) / float(uSize);

  vec2 up = texture2D(uInputTexture, vec2(texCoordUp, 0.5)).rg;
  vec2 down = texture2D(uInputTexture, vec2(texCoordDown, 0.5)).rg;

  // 蝶形运算：output = up + Wnk * down
  vec2 wnk = calculateWnk(n, k, uInverse);
  vec2 twiddle = complexMul(wnk, down);
  vec2 result = up + twiddle;

  gl_FragColor = vec4(result, 0.0, 1.0);
}
