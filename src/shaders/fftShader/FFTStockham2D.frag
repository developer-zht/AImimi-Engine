#ifdef GL_ES
#extension GL_EXT_draw_buffers: enable
precision highp float;
#endif

// 保留原来的单个 Texture 的求解方法，用来验证多个 Texture 的方法的正确性
// uniform sampler2D uInputTexture; 
// ✅ 多个输入纹理（最多 4 个）
uniform sampler2D uInputTexture0;
uniform sampler2D uInputTexture1;
uniform sampler2D uInputTexture2;
uniform sampler2D uInputTexture3;

uniform int uNumChannels;
uniform int uSubtransformSize;
uniform int uTransformSize;
uniform int uInverse;
uniform int uDirection; // 0=水平, 1=垂直
uniform bool uFinalStage;  // 是否是最后一个 stage，如果是则将所有 result 的 real 部分输出到 gl_FragData[0]

varying vec2 vTexCoord;

#define M_PI 3.1415926535897932384626433832795
#define TWO_PI 6.283185307

// 复数乘法
vec2 complexMul(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

void main() {
  // 1. 根据方向确定当前索引
  float outputIndex;
  if (uDirection == 0) {
    // 水平方向：处理当前行
    outputIndex = vTexCoord.x * float(uTransformSize) - 0.5;
    // outputIndex = floor(vTexCoord.x * float(uTransformSize));
  } else {
    // 垂直方向：处理当前列
    outputIndex = vTexCoord.y * float(uTransformSize) - 0.5;
    // outputIndex = floor(vTexCoord.y * float(uTransformSize));
  }

  // 2. 计算 even/odd 索引（Stockham 重排）
  float halfSubSize = float(uSubtransformSize) * 0.5;
  float evenIndex = floor(outputIndex / float(uSubtransformSize)) * halfSubSize + mod(outputIndex, halfSubSize);

  // 3. 计算采样坐标
  vec2 evenCoord, oddCoord;
  // 3. 读取 even 和 odd 样本
  // 保留原来的单个 Texture 的求解方法，用来验证多个 Texture 的方法的正确性
  // vec2 even, odd;

  if (uDirection == 0) {
    // 水平FFT: 沿x轴读取
    float evenU = (evenIndex + 0.5) / float(uTransformSize);
    float oddU = (evenIndex + float(uTransformSize) * 0.5 + 0.5) / float(uTransformSize);

    evenCoord = vec2(evenU, vTexCoord.y);
    oddCoord = vec2(oddU, vTexCoord.y);
    // 保留原来的单个 Texture 的求解方法，用来验证多个 Texture 的方法的正确性
    // even = texture2D(uInputTexture, vec2(evenU, vTexCoord.y)).rg;
    // odd = texture2D(uInputTexture, vec2(oddU, vTexCoord.y)).rg;
  } else {
    // 垂直FFT: 沿y轴读取
    float evenV = (evenIndex + 0.5) / float(uTransformSize);
    float oddV = (evenIndex + float(uTransformSize) * 0.5 + 0.5) / float(uTransformSize);

    evenCoord = vec2(vTexCoord.x, evenV);
    oddCoord = vec2(vTexCoord.x, oddV);
    // 保留原来的单个 Texture 的求解方法，用来验证多个 Texture 的方法的正确性
    // even = texture2D(uInputTexture, vec2(vTexCoord.x, evenV)).rg;
    // odd = texture2D(uInputTexture, vec2(vTexCoord.x, oddV)).rg;
  }

  // 4. 计算旋转因子
  float sign = uInverse == 1 ? 1.0 : -1.0;
  float twiddleArgument = sign * TWO_PI * (outputIndex / float(uSubtransformSize));
  vec2 twiddle = vec2(cos(twiddleArgument), sin(twiddleArgument));

  // 保留原来的单个 Texture 的求解方法，用来验证多个 Texture 的方法的正确性
  // vec2 result = even + complexMul(twiddle,odd);
  // ✅ 5. 并行处理所有通道（1-4 个）
  vec2 result0 = vec2(0.0,0.0);
  vec2 result1 = vec2(0.0,0.0);
  vec2 result2 = vec2(0.0,0.0);
  vec2 result3 = vec2(0.0,0.0);

  // Channel 0 (必定存在)
  vec2 even0 = texture2D(uInputTexture0, evenCoord).rg;
  vec2 odd0 = texture2D(uInputTexture0, oddCoord).rg;
  result0 = even0 + complexMul(twiddle, odd0);
  gl_FragData[0] = vec4( result0 , 0.0, 1.0);

  // Channel 1 (如果存在)
  if (uNumChannels >= 2) {
    vec2 even1 = texture2D(uInputTexture1, evenCoord).rg;
    vec2 odd1 = texture2D(uInputTexture1, oddCoord).rg;
    result1 = even1 + complexMul(twiddle, odd1);
    gl_FragData[1] = vec4(result1, 0.0, 1.0);
  }

  // Channel 2 (如果存在)
  if (uNumChannels >= 3) {
    vec2 even2 = texture2D(uInputTexture2, evenCoord).rg;
    vec2 odd2 = texture2D(uInputTexture2, oddCoord).rg;
    result2 = even2 + complexMul(twiddle, odd2);
    gl_FragData[2] = vec4(result2, 0.0, 1.0);
  }

  // Channel 3 (如果存在)
  if (uNumChannels >= 4) {
    vec2 even3 = texture2D(uInputTexture3, evenCoord).rg;
    vec2 odd3 = texture2D(uInputTexture3, oddCoord).rg;
    result3 = even3 + complexMul(twiddle, odd3);
    gl_FragData[3] = vec4(result3, 0.0, 1.0);
  }

  if(uFinalStage){
    // IFFT 归一化参数
    float scale = 1.0 / (float(uTransformSize) * float(uTransformSize));
    vec4 result = vec4(result0.r, result1.r, result2.r, result3.r);
    result *= scale;
    gl_FragData[0] = result;
  }

  // gl_FragColor = vec4(result,0.0,1.0);
}

// void main() {
//   // ✅ 1. 修正：直接计算像素索引（整数）
//   float outputIndex;
//   if (uDirection == 0) {
//     // 水平方向
//     outputIndex = floor(vTexCoord.x * float(uTransformSize));
//   } else {
//     // 垂直方向
//     outputIndex = floor(vTexCoord.y * float(uTransformSize));
//   }

//   // ✅ 2. Stockham 索引计算
//   float halfSubSize = float(uSubtransformSize) / 2.0;

//   // evenIndex = (outputIndex / subtransformSize) * halfSubSize + (outputIndex % halfSubSize)
//   float groupIndex = floor(outputIndex / float(uSubtransformSize));
//   float indexInGroup = mod(outputIndex, halfSubSize);
//   float evenIndex = groupIndex * halfSubSize + indexInGroup;

//   // oddIndex 在输入序列的后半部分
//   float oddIndex = evenIndex + float(uTransformSize) / 2.0;

//   // ✅ 3. 计算纹理坐标（像素中心）
//   vec2 even, odd;

//   if (uDirection == 0) {
//     // 水平FFT
//     float evenU = (evenIndex + 0.5) / float(uTransformSize);
//     float oddU = (oddIndex + 0.5) / float(uTransformSize);

//     even = texture2D(uInputTexture, vec2(evenU, vTexCoord.y)).rg;
//     odd = texture2D(uInputTexture, vec2(oddU, vTexCoord.y)).rg;
//   } else {
//     // 垂直FFT
//     float evenV = (evenIndex + 0.5) / float(uTransformSize);
//     float oddV = (oddIndex + 0.5) / float(uTransformSize);

//     even = texture2D(uInputTexture, vec2(vTexCoord.x, evenV)).rg;
//     odd = texture2D(uInputTexture, vec2(vTexCoord.x, oddV)).rg;
//   }

//   // ✅ 4. 计算旋转因子（修正符号）
//   float sign = uInverse == 1 ? 1.0 : -1.0;

//   // k = outputIndex % subtransformSize
//   float k = mod(outputIndex, float(uSubtransformSize));

//   // W_n^k = e^(sign * 2πi * k / n)
//   float angle = sign * TWO_PI * k / float(uSubtransformSize);
//   vec2 twiddle = vec2(cos(angle), sin(angle));

//   // ✅ 5. 蝶形运算
//   vec2 result = even + complexMul(twiddle, odd);

//   gl_FragColor = vec4(twiddle, 0.0, 1.0);
//   // gl_FragColor = vec4(20.0, 10.0, 0.0, 1.0);
// }

