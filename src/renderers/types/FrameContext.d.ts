/**
 * 每帧由 WebGLRenderer 构建，传递给所有 BaseRenderer 和 RenderManager。
 *
 * 设计原则：
 * - 只包含真正全局的、每帧变化的信息
 * - 场景级 uniform（如灯光参数）不在这里，由 WebGLRenderer 单独推送给相关 Material
 * - textureUnitCounter 是 mutable 的，随着每个材质的 applyUniforms 调用而递增
 */

export interface FrameContext {
  // ============== 时间 ==============
  /** 自应用启动以来经过的时间（秒） */
  elapsedTime: number
  /** 上一帧到当前帧的时间差（秒），用于物理模拟和动画 */
  deltaTime: number
  /** 当前帧序号（从 0 开始递增） */
  frame: number

  // ============== 画布状态 ==============
  /** 画布/视口分辨率（像素），对应 Shadertoy 的 iResolution */
  resolution: { width: number; height: number }

  // ============== 输入状态 ==============
  /** 鼠标状态，对应 Shadertoy 的 iMouse */
  mouse: {
    x: number // 归一化坐标 [0, 1]，左下角为原点
    y: number
    clickX: number
    clickY: number
    pressed: boolean // 鼠标左键是否按下
  }

  // ============== 渲染状态（mutable） ==============
  /**
   * 纹理单元计数器
   *
   * WebGL 有有限的纹理槽位（TEXTURE0 ~ TEXTURE31）。
   * 每帧开始时重置为 0，每次绑定纹理时递增。
   * 这是 FrameContext 中唯一可变的字段。
   */
  textureUnitCounter: number
}
