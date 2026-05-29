/**
 * FFT Stockham — 1D Fragment Shader (单输入 / 单方向)
 *
 * 算法：Cooley–Tukey radix-2 的 Stockham 重排版（in-place ping-pong，零位反序）
 *   - 每个 stage 的 subtransform 大小 sub = 2, 4, 8, ..., N
 *   - 经过 log₂(N) 次 stage 后得到完整 1D DFT / IDFT
 *
 * 数学模型：
 *   1D DFT     X[k] = Σ_{n=0..N-1} x[n] · W_N^{kn}      W_N = exp(-2πi/N)
 *   1D IDFT    x[n] = (1/N) · Σ_{k=0..N-1} X[k] · W_N^{-kn}
 *   蝶形       Y_i  = x_even[i] + W_{sub}^{i} · x_odd[i]
 *
 * 用途：
 *   仅用于 1D FFT 验证 / debug。生产路径走 FFTStockham2D.frag（带 MRT 多通道）。
 *
 * I/O：
 *   uInputTexture     — 上一 stage 的 (N × 1) 复数纹理（RG = Re/Im）
 *   uSubtransformSize — 当前 stage 的 subtransform 大小 sub（2, 4, ..., N）
 *   uTransformSize    — 总 FFT 大小 N（2 的幂）
 *   uInverse          — 0 = 正变换（W^{−}）；1 = 逆变换（W^{+}）
 *   gl_FragColor.rg   — 该像素对应输出索引的 (Re, Im)；
 *                       归一化 1/N 由调用方决定（本 shader 不做）
 */

#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D uInputTexture;
uniform int uSubtransformSize; // 当前 stage 的 subtransform 大小 sub: 2, 4, 8, ..., N（无量纲）
uniform int uTransformSize; // 总 FFT 大小 N（2 的幂，无量纲）
uniform int uInverse; // 0 = 正变换；1 = 逆变换

varying vec2 vTexCoord;

#define M_PI 3.1415926535897932384626433832795
#define TWO_PI 6.283185307

// ============================================================
// 复数工具
// ============================================================

/**
 * 复数乘法 (a.x + i·a.y) · (b.x + i·b.y)
 *
 * 数学：
 *   (a + ib)(c + id) = (ac − bd) + i(ad + bc)
 *
 * @param a  复数 a = a.x + i·a.y
 * @param b  复数 b = b.x + i·b.y
 * @return   a·b 的 (Re, Im)（与输入同量纲）
 */
vec2 complexMul(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

// ============================================================
// 主体：Stockham 一维蝶形
// ============================================================
void main() {
  // ---- 1) 由 UV 反算当前输出像素的索引 ----
  // 假设输入纹理排布为 (N × 1)；UV.x ∈ [0, 1)，像素中心 = (i + 0.5)/N
  // 物理意义：本次 stage 要"填"输出序列第 outputIndex 个样本
  float outputIndex = vTexCoord.x * float(uTransformSize) - 0.5;

  // ---- 2) Stockham 的 even / odd 输入索引 ----
  // 重排公式（替代 Cooley–Tukey 的位反序）：
  //   evenIndex = ⌊outputIndex / sub⌋ · (sub/2) + (outputIndex mod (sub/2))
  //   oddIndex  = evenIndex + N/2     ←  上一 stage 写出的"前半 even / 后半 odd"布局
  float halfSubSize = float(uSubtransformSize) * 0.5;
  float evenIndex = floor(outputIndex / float(uSubtransformSize)) * halfSubSize + mod(outputIndex, halfSubSize);

  // ---- 3) 采样 even / odd 样本（每个样本 = 复数 RG） ----
  // 用纹素中心 (i + 0.5)/N 避免双线性插值误差
  float evenU = (evenIndex + 0.5) / float(uTransformSize);
  vec2 even = texture2D(uInputTexture, vec2(evenU, 0.5)).rg;

  // odd 样本位于后半部分（偏移 transformSize/2）
  float oddIndex = evenIndex + float(uTransformSize) * 0.5;
  float oddU = (oddIndex + 0.5) / float(uTransformSize);
  vec2 odd = texture2D(uInputTexture, vec2(oddU, 0.5)).rg;

  // ---- 4) 旋转因子 (twiddle factor) ----
  // W_sub^k = exp(sign · 2π i · k / sub)
  //   sign = −1 → 正变换；sign = +1 → 逆变换
  //   k    = outputIndex 在子变换内的下标
  //          这里用 (outputIndex / sub) 等价于 (k / sub) 的连续推广
  float sign = uInverse == 1 ? 1.0 : -1.0;
  float twiddleArgument = sign * TWO_PI * (outputIndex / float(uSubtransformSize));
  vec2 twiddle = vec2(cos(twiddleArgument), sin(twiddleArgument));

  // ---- 5) 蝶形：output = even + W · odd ----
  vec2 result = even + complexMul(twiddle, odd);

  gl_FragColor = vec4(result.x, result.y, 0.0, 1.0);
}
