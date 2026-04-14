/**
 * WebGL 能力检测结果（GL Capabilities）
 *
 * 👉 用于：
 * - 在初始化阶段检测 GPU / 浏览器支持情况
 * - 决定渲染路径（fallback / degrade）
 * - 避免运行时错误（如不支持的纹理格式）
 *
 * 👉 通常来源：
 * - gl.getExtension(...)
 *
 * ---
 *
 * ⚠️ 为什么必须做 capability 检测？
 *
 * WebGL 是“软标准”：
 * - 不同 GPU / 浏览器支持的扩展不同
 * - 同一功能可能需要扩展才能启用
 *
 * 👉 不检测的后果：
 * - framebuffer incomplete
 * - 纹理无法采样
 * - 渲染结果全黑
 */
export interface GLCapabilities {
  /**
   * 是否支持浮点纹理（32-bit float texture）
   *
   * 👉 对应扩展：
   * - WebGL1: OES_texture_float
   * - WebGL2: 内建支持
   *
   * 👉 用途：
   * - HDR 渲染（高动态范围）
   * - G-buffer（延迟渲染）
   * - 物理模拟（如 FFT 水面）
   *
   * ❗ 不支持时：
   * - 无法使用 gl.FLOAT 作为纹理数据类型
   */
  floatTexture: boolean

  /**
   * 是否支持半浮点纹理（16-bit float / half float）
   *
   * 👉 对应扩展：
   * - WebGL1: OES_texture_half_float
   * - WebGL2: 内建支持
   *
   * 👉 优势：
   * - 比 float 节省显存（16bit vs 32bit）
   * - 精度足够用于大多数 HDR 场景
   *
   * 👉 常见用途：
   * - 后处理（Bloom / SSR / SSAO）
   *
   * ❗ 不支持时：
   * - 只能 fallback 到 UNSIGNED_BYTE（精度损失明显）
   */
  halfFloatTexture: boolean

  /**
   * 是否支持浮点纹理的线性过滤（LINEAR filtering）
   *
   * 👉 对应扩展：
   * - OES_texture_float_linear
   * - OES_texture_half_float_linear
   *
   * 👉 作用：
   * - 允许对 float / half-float texture 使用：
   *   gl.LINEAR / gl.LINEAR_MIPMAP_LINEAR
   *
   * ❗ 不支持时：
   * - 只能使用 gl.NEAREST（最近邻采样）
   *
   * 👉 影响：
   * - 后处理会出现 blocky / 像素化
   * - SSAO / SSR / Bloom 效果明显变差
   */
  floatLinearFilter: boolean

  /**
   * 是否支持深度纹理（Depth Texture）
   *
   * 👉 对应扩展：
   * - WebGL1: WEBGL_depth_texture
   * - WebGL2: 内建支持
   *
   * 👉 用途：
   * - Shadow Mapping（核心）
   * - SSAO（读取深度）
   * - 屏幕空间效果（SSR / DOF）
   *
   * 👉 能力：
   * - 可以将 depth attachment 作为 texture 采样
   *
   * ❗ 不支持时：
   * - 无法直接读取深度
   * - 需要手动 pack depth → color（精度差 + 麻烦）
   */
  depthTexture: boolean

  /**
   * 是否支持多渲染目标（Multiple Render Targets, MRT）
   *
   * 👉 对应扩展：
   * - WebGL1: WEBGL_draw_buffers
   * - WebGL2: 内建支持（gl.drawBuffers）
   *
   * 👉 用途：
   * - 延迟渲染（Deferred Rendering）
   * - 一次 pass 输出多个 buffer（G-buffer）
   *
   * 👉 示例：
   * - position / normal / albedo 同时写入
   *
   * ❗ 不支持时：
   * - 必须拆成多 pass（性能下降）
   */
  drawBuffers: boolean
}
