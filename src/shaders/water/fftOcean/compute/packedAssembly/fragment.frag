/**
 * Packed IFFT Assembly — Fragment Shader (MRT 输出)
 *
 * 作用：
 *   把 FFTStockham2D 的 4 张 packed IFFT 输出（每张 RG = 复数 Re/Im）解包成
 *   3 张可被光栅着色器直接采样的物理量纹理，并完成 choppiness 应用、斜率修正、
 *   Jacobian 计算与 Foam 累积。
 *
 * 输入（与 realtimeSpectrum/fragment.frag pack 顺序一致）：
 *   uPacked0 = height + i·dDz_dx     →  (Dy, ∂Dx/∂z)        [m, 1]
 *   uPacked1 = dispX  + i·dispZ      →  (Dx, Dz)            [m, m]
 *   uPacked2 = slopeX + i·slopeZ     →  (∂Dy/∂x, ∂Dy/∂z)    [1, 1]
 *   uPacked3 = dDx_dx + i·dDz_dz     →  Jacobian 对角        [1, 1]
 *
 * 输出（MRT，3 个 color attachment）：
 *   gl_FragData[0] = displacement = (Dx·α, Dy, Dz·β, foam)   [m, m, m, ∈[0,1]]
 *   gl_FragData[1] = gradient     = (slopeX_corr, slopeZ_corr, 0, 0)
 *   gl_FragData[2] = derivatives  = (∂Dx/∂x, ∂Dz/∂z, ∂Dz/∂x, jacobian)
 *
 * 空域后处理 step-by-step：
 *   1) α = uChoppiness.x, β = uChoppiness.y 缩放水平位移
 *   2) 由 (1 + α·∂Dx/∂x) / (1 + β·∂Dz/∂z) 对斜率做 Eulerian 修正
 *   3) Jacobian det 检测折叠（< 0 即破碎），EMA 累积驱动 Foam
 */

#ifdef GL_ES
precision highp float;
#endif

// prettier-ignore
#extension GL_EXT_draw_buffers: enable

varying vec2 vTexCoord;

// ============================================================
// Uniforms
// ============================================================

// ---- 4 张 packed IFFT 输入 ----
uniform sampler2D uPacked0; // height + i·dDz_dx
uniform sampler2D uPacked1; // dispX  + i·dispZ
uniform sampler2D uPacked2; // slopeX + i·slopeZ
uniform sampler2D uPacked3; // dDx_dx + i·dDz_dz

uniform vec2 uChoppiness; // (α, β)，水平位移缩放（艺术量，通常 ∈ [0, 2.5]）

// ---- Foam 累积（详见下方 calcFoam 推导） ----
uniform sampler2D uPrevDisplacement; // 上一帧 finalFBO 的 attachment 0（仅取 .a = foam）
uniform float uFoamDecayRate; // EMA 衰减率 λ_decay [1/frame]，默认 0.05
uniform float uFoamAdd; // 新增 Foam 系数 [1]，默认 0.10
uniform float uFoamBias; // J 阈值偏置 [1]，默认 0.20 ← J<bias 即视为破碎
uniform float uFoamPower; // 锐度指数 [1]，默认 1.5

// ============================================================
// 主体
// ============================================================

void main() {
  // ---- 1) 解包 4 张 packed 复数纹理 ----
  vec2 p0 = texture2D(uPacked0, vTexCoord).rg;
  vec2 p1 = texture2D(uPacked1, vTexCoord).rg;
  vec2 p2 = texture2D(uPacked2, vTexCoord).rg;
  vec2 p3 = texture2D(uPacked3, vTexCoord).rg;

  float Dy = p0.r;
  float dDz_dx = p0.g; // = ∂Dx/∂z

  float Dx = p1.r;
  float Dz = p1.g;

  float slopeX = p2.r; // ∂Dy/∂x
  float slopeZ = p2.g; // ∂Dy/∂z

  float dDx_dx = p3.r;
  float dDz_dz = p3.g;

  // ---- 2) Choppiness：水平位移缩放 ----
  // 物理动机：Tessendorf 的 disp.x/z 振幅默认偏小；α/β 用作艺术调节，
  //          α > 1 让波峰更尖锐（"choppy waves"）。
  // 水平位移使用 choppiness
  float finalDx = Dx * uChoppiness.x;
  float finalDz = Dz * uChoppiness.y;

  // ---- 3) 斜率 Eulerian 修正：slope / (1 + α·∂D/∂x) ----

  /**
 * 数学推导（以 X 方向为例）：
 *   显示网格 mesh 顶点本身被水平偏移：
 *     x_vertex = x + α · Dx(x, z)
 *     z_vertex = z + β · Dz(x, z)
 *     h_display(x_vertex, z_vertex) = h_IFFT(x, z) = Dy(x, z)
 *    
 *   要的是显示空间下的斜率 ∂h_display / ∂x_vertex，但 IFFT 给的是 Lagrangian 斜率
 *   ∂h / ∂x（参数空间）。链式法则：
 *     ∂h_display / ∂x_vertex
 *       = ∂h/∂x · ∂x/∂x_vertex + ∂h/∂z · ∂z/∂x_vertex
 *   忽略 ∂z/∂x_vertex（与 ∂Dz/∂x 同阶但小项）：
 *     ∂h_display / ∂x_vertex ≈ (∂h/∂x) / (1 + α·∂Dx/∂x)
 *    
 * 数值实现：
 *   分母 denomX = 1 + α·∂Dx/∂x
 *     - denomX > 0：常规
 *     - denomX → 0：折叠边界（数学奇点），slope 会被除到爆炸
 *     - denomX < 0：物理上折叠（J < 0），slope 自然翻向
 *   用 max(denomX, 0.3) 做下界 clamp：
 *     0.3 不是为了"防 0 除"那么简单——掠射角下折叠边缘附近 denom 接近 0 时，
 *     slope 会被放大成极大值，重建出的法线乱跳，在画面上表现为"暗色条纹"伪影。
 *     把下界抬到 0.3（而非 0.01）相当于牺牲折叠边缘一点物理精度，
 *     换取抑制这些 streak —— 该区域本就该被上层 foam 覆盖，精度损失不可见。
 */
  // 在折叠区域 (Jacobian < 0) 分母自然变负，slope 会翻向——这是物理正确的。
  float denomX = 1.0 + uChoppiness.x * dDx_dx;
  float denomZ = 1.0 + uChoppiness.y * dDz_dz;
  // 下界 clamp 到 0.3：抑制折叠边缘 slope 爆炸导致的暗条纹（streak），该区域由 foam 覆盖
  float slopeX_corr = slopeX / max(denomX, 0.3);
  float slopeZ_corr = slopeZ / max(denomZ, 0.3);

  // ---- 4) Jacobian 行列式（折叠检测 / Foam 触发） ----
  /**
 * 映射 (x, z) → (x', z') = (x + α·Dx, z + β·Dz) 的 Jacobian 矩阵：
 *    
 *     J = ⎡ 1 + α·∂Dx/∂x    α·∂Dx/∂z   ⎤
 *         ⎣ β·∂Dz/∂x       1 + β·∂Dz/∂z ⎦
 *    
 *   det(J) = (1 + α·∂Dx/∂x)(1 + β·∂Dz/∂z) − α·β·(∂Dx/∂z)·(∂Dz/∂x)
 *    
 * 对称性 ∂Dx/∂z = ∂Dz/∂x：
 *   两者都来自同一频谱：∂Dx/∂z = IFFT(i·kz · disp̃X) = IFFT(i·kx · disp̃Z) = ∂Dz/∂x
 *   （Tessendorf 推导见 eq.29~31）。故 GPU 端只存一份 dDz_dx。
 *    
 * 物理含义：
 *   det(J) > 0     局部拉伸但保拓扑
 *   det(J) → 0     折叠边界，波峰将破碎
 *   det(J) < 0     物理上不再单值（surface fold）
 *    
 * 用 det(J) 触发 Foam（见下一步）；同时 attachment 2 也把 det(J) 输出供调试。
 */
  float dDx_dz = dDz_dx;
  float jacobian =
    (1.0 + uChoppiness.x * dDx_dx) * (1.0 + uChoppiness.y * dDz_dz) - uChoppiness.x * uChoppiness.y * (dDz_dx * dDx_dz);

  // ---- 5) Foam EMA 累积 ----
  /**
 * 物理动机：
 *   破碎只在 J < bias 的区域产生气泡，但气泡形成后会持续存在数秒（重力/表面张力慢衰减）。
 *   故用「指数加权平均（EMA）」让历史 Foam 平滑衰减、新破碎瞬时入账。
 *    
 * 数学：
 *   biased  = max(0, -(J_clamped - bias))           当前帧"新破碎量"
 *           其中 J_clamped = clamp(J, 0, 1)^uFoamPower，让锐度可控
 *   foam_t  = clamp( foam_{t-1} · e^{-λ_decay}  +  uFoamAdd · biased,  0, 1 )
 *           ↑ 历史衰减                            ↑ 新增
 *    
 * 数值：
 *   - prevFoam 来自上一帧 final FBO（双缓冲，由 ping-pong 切换）
 *   - exp(-0.05) ≈ 0.951 → 约 60 帧（@60fps，1s）残留 5%
 *   - 上界 clamp(_, 0, 1) 防止 EMA 累积爆表
 */
  float jClamped = pow(clamp(jacobian, 0.0, 1.0), uFoamPower);
  float biased = max(0.0, -(jClamped - uFoamBias));
  float prevFoam = texture2D(uPrevDisplacement, vTexCoord).a;
  float foam = clamp(prevFoam * exp(-uFoamDecayRate) + uFoamAdd * biased, 0.0, 1.0);

  // ---- 6) MRT 输出 ----
  // attachment 0 : (Dx·α, Dy, Dz·β, foam)
  gl_FragData[0] = vec4(finalDx, Dy, finalDz, foam);
  // attachment 1 : 修正后斜率（仅 XZ；其余通道留空）
  gl_FragData[1] = vec4(slopeX_corr, slopeZ_corr, 0.0, 0.0);
  // attachment 2 : Jacobian 原始分量 + det（最后 1 个通道存 det 便于调试可视化）
  gl_FragData[2] = vec4(dDx_dx, dDz_dz, dDz_dx, jacobian);

}
