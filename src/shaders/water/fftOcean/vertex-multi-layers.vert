/**
 * FFT Ocean Multi-Layers — Vertex Shader
 *
 * 作用：
 *   把平面 mesh 顶点按 4 层 cascade displacement map 进行位移，
 *   转换到世界 / clip 空间，并把世界坐标 / 波高 / 深度等几何信息透传到 fragment shader
 *   供光照、SSS、Foam 与近远场过渡使用。
 *
 * 物理 / 数学模型（Tessendorf FFT Ocean，多频段 cascade 叠加）：
 *   每层有独立的物理域大小 L_i (= uLayerSize_i, [m]) 与采样权重 c_i (= uLayerContribute_i)。
 *   FFT 谱描述的是 L_i × L_i 米一小块海面（周期延拓）。
 *   总位移：
 *     D(x, z) = Σ_{i=0..3}  c_i · IFFT_i( worldXZ / L_i )
 *   顶点位移到：
 *     P(x, z) = ( x + D.x ,  D.y ,  z + D.z )
 *   注：水平 choppiness χ 在 packedAssembly 阶段已应用到 D.x / D.z，
 *       此处的 displacement 已是 χ-scaled 量。
 *
 * 实现说明：
 *   1) 在 model space 采样 displacement，再做 model→world，确保 displacement
 *      纹理的坐标系语义与采样空间一致；若在 world space 采样会与 mesh transform 冲突。
 *   2) 各层共用同一组 worldXZ，仅除以各自 L_i 做平铺，保证波长保真。
 *
 * ⚠️ 历史轴向 Bug（已修复）：
 *   FFT 输出纹理 X/Y 轴本应对应空间 z/x 方向 ——
 *   频谱按 row-major 存储 (kx → texY, kz → texX)，经 IFFT 后保持轴对应：
 *     - texture Y 轴 = IFFT(kx 谱) = 空间 x 方向
 *     - texture X 轴 = IFFT(kz 谱) = 空间 z 方向
 *   但顶点采样 uv = (world.x/L, world.z/L) 默认把 world.x 喂给 texture X 轴：
 *     - uv.x = world.x → texture X → 实为 z 方向
 *     - uv.y = world.z → texture Y → 实为 x 方向
 *   即两套约定不一致。
 *   ✅ 已在频谱端修复（让 kx 沿 texture X、kz 沿 texture Y），路径：
 *     - CPU： src/simulation/ocean/fft/RealtimeSpectrum-v2.ts
 *     - GPU： src/shaders/water/fftOcean/compute/realtimeSpectrum/fragment.frag
 *   修复后顶点这里直接 uv = worldXZ / L 即正确。
 *
 * I/O：
 *   aVertexPosition       model-space 顶点位置
 *   aTextureCoord         网格 UV（当前未使用，留作扩展）
 *   uModelMatrix          model → world 变换
 *   uViewMatrix           world → view
 *   uProjectionMatrix     view → clip
 *   uDisplacementMap0..3  4 层 cascade 位移纹理 (Dx, Dy, Dz, foam)  [m, m, m, ∈[0,1]]
 *   uLayerSize0..3        每层物理域大小 L_i  [m]
 *   uLayerContribute0..3  每层采样权重 c_i ∈ [0, 1]，艺术调节；置 0 即关闭该层
 *   vWorldPosition        位移后的世界坐标（含水平 Dx / Dz 偏移）—— 光照计算用
 *   vWorldXZ              位移后的世界 XZ —— 光照计算用
 *   vSampleWorldXZ        ★ 未偏移的世界 XZ —— displacement / gradient 二次采样用
 *   vWaveHeight           max(Dy, 0)  [m]，供 fragment SSS 的 k1 项
 *   vClipDepth            ∈ [0, 1]：50m 附近 ≈ 1，远处衰减 —— "近真远假"过渡权重
 *   vDisplacementY        Dy 原值  [m]，备用：Beer–Lambert 光程 / 透射率
 */

// prettier-ignore
#extension GL_EXT_shader_texture_lod : enable

// ============================================================
// Attributes
// ============================================================
attribute vec3 aVertexPosition;
attribute vec2 aTextureCoord;

// ============================================================
// MVP 矩阵
// ============================================================
uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

// ============================================================
// FFT Cascade 位移
// ============================================================

// ---- 4 层位移纹理：(Dx, Dy, Dz, foam) ----
uniform sampler2D uDisplacementMap0;
uniform sampler2D uDisplacementMap1;
uniform sampler2D uDisplacementMap2;
uniform sampler2D uDisplacementMap3;

// ---- 每层物理域大小 L_i [m]，决定 FFT patch 的空间尺度 ----
uniform float uLayerSize0;
uniform float uLayerSize1;
uniform float uLayerSize2;
uniform float uLayerSize3;

// ---- 每层采样权重 c_i（艺术量）；置 0 即关闭该层 ----
uniform float uLayerContribute0;
uniform float uLayerContribute1;
uniform float uLayerContribute2;
uniform float uLayerContribute3;

// ============================================================
// Varyings → Fragment Shader
// ============================================================

// ---- 位置 / 光照专用世界坐标（已含 Dx, Dz 水平偏移） ----
// 做了 x + Dx * uChoppiness.x 和 z + Dz * uChoppiness.y 的偏移
varying vec3 vWorldPosition;
varying vec2 vWorldXZ;

// ---- 采样专用世界坐标（未偏移，避免 fragment 二次采样自相关） ----
varying vec2 vSampleWorldXZ;

// ---- 波高 [m]，供 fragment 的 SSS k1 计算 ----
varying float vWaveHeight;

// ---- 片元深度权重，用于"近真远假"过渡（衰减、Foam 强度等）----
// vClipDepth = clamp(1 / clip.w · 50, 0, 1)
// 50 是经验系数：50m 附近 vClipDepth ≈ 1，远处线性下降
varying float vClipDepth;

// ---- 当前 fragment 的垂直位移分量，备用：Beer–Lambert 光程 / 透射率 ----
varying float vDisplacementY; // vDisplacementY = displacement.y

// ============================================================
// 主体
// ============================================================

void main() {
  // ==================== 在 model space 采样和处理位移 ====================
  // ---- 1) Model-space 采样准备 ----
  // displacement map 的语义建立在 model space 下，故先做 model→world 拿 worldXZ，再用它作为采样坐标；
  vec2 worldXZ = (uModelMatrix * vec4(aVertexPosition, 1.0)).xz;

  // ---- 2) 4 层 cascade 位移叠加 ----
  /**
 * FFT 纹理在频域里假设空间是周期性的 L 米一个周期。也就是说这张 N×N 纹理物理上描述的是 L×L(uLayerSize * uLayerSize) 米见方的一小块海面，存的是那一小块的位移/梯度。
 * uv = worldXZ / L：纹理按真实物理尺度平铺，波长保真
 *
 * 本质：FFT 输出是"L 米样本"，视觉 mesh 比 L 大就必须 tile。每层各自的 L 不同,自然每层 worldXZ 除以各自的 L。
 *
 * ⚠️ 特别注意：
 *  频谱计算里由于是「row-major」，因此是按照 x=0(z=0...N)、x=1(z=0...N)、x=2(z=0...N)... 这样的顺序存储的，于是 kx 就被绑定到了 texture Y 轴上，也就是说频谱纹理的 Y 轴是 kx 方向，X 轴是 kz 方向。
 *  经过 IFFT 后，频域 → 空域的映射保持轴对应：
 *   - texture Y 轴 = IFFT(kx 谱) = 空间 x 方向
 *   - texture X 轴 = IFFT(kz 谱) = 空间 z 方向
 *
 *  但上述理论中所说的顶点采样 uv = worldXZ / L 方法，即 uv = (world.x/L, world.z/L)，默认把 world.x 作为 u 坐标绑定到了 texture X 轴上：
 *   - uv.x = world.x → 喂给 texture X 轴 → 但 texture X 轴 = 空间 z 方向
 *   - uv.y = world.z → 喂给 texture Y 轴 → 但 texture Y 轴 = 空间 x 方向
 *
 * 导致两套约定不一致。
 *  
 * ✅ 此 Bug 已在下述代码中已修复：
 *  - 参与 CPU 端计算的 src/simulation/ocean/fft/RealtimeSpectrum-v2.ts
 *  - 参与 GPU 端计算的 src/shaders/water/fftOcean/compute/realtimeSpectrum/fragment.frag
 */
  vec3 d0 = texture2D(uDisplacementMap0, worldXZ / uLayerSize0).xyz;
  vec3 d1 = texture2D(uDisplacementMap1, worldXZ / uLayerSize1).xyz;
  vec3 d2 = texture2D(uDisplacementMap2, worldXZ / uLayerSize2).xyz;
  vec3 d3 = texture2D(uDisplacementMap3, worldXZ / uLayerSize3).xyz;
  vec3 displacement = d0 * uLayerContribute0 + d1 * uLayerContribute1 + d2 * uLayerContribute2 + d3 * uLayerContribute3;

  // ---- 3) 应用位移 → 世界空间 ----
  vec3 displacedModelPos = aVertexPosition + displacement;
  vec4 displacedWorldPos = uModelMatrix * vec4(displacedModelPos, 1.0);

  // ---- 4) 透传 varyings（位置 / 几何） ----

  // 位置 / 光照专用（含水平偏移）
  // 做了 x + Dx * uChoppiness.x 和 z + Dz * uChoppiness.y 的偏移
  vWorldPosition = displacedWorldPos.xyz;
  vWorldXZ = displacedWorldPos.xz;

  // 采样专用：保留未偏移坐标，避免 fragment 端二次采样时引入自相关误差
  vSampleWorldXZ = worldXZ;

  // SSS k1 需要的波高 [m]（只取正值，水面下不贡献逆光散射）
  vWaveHeight = max(displacement.y, 0.0);

  // ---- 5) Clip-space 深度权重，用于根据距离衰减或遮蔽系数 ----

  // vClipDepth ∈ [0, 1]：50m 附近 ≈ 1，远处线性衰减
  // 用作"近真远假"过渡（衰减、Foam 强度、normal 远场切换等）的距离权重
  // w > 0 守卫保证投影矩阵反向时不写 NaN
  vec4 clipPos = uProjectionMatrix * uViewMatrix * displacedWorldPos;
  vClipDepth = clipPos.w > 0.0 ? clamp(1.0 / clipPos.w * 50.0, 0.0, 1.0) : 1.0;

  // 备用：Beer–Lambert 光程 / 透射率项可用 Dy 反推水下深度
  vDisplacementY = displacement.y;

  gl_Position = uProjectionMatrix * uViewMatrix * displacedWorldPos;
}
