import { FrameContext } from '@/renderers/types/FrameContext'

/**
 * 任何需要在渲染前做计算的模块都可以实现此接口，
 * 然后通过 baseRenderer.addManager() 挂载。
 *
 * 典型用途：
 * - FFT 海洋：生成频谱 → FFT变换 → 更新纹理
 * - 粒子系统：更新粒子位置 → 写入 VBO
 * - 骨骼动画：计算骨骼矩阵 → 写入 uniform
 */
export interface RenderManager {
  /** 唯一标识符 */
  readonly name: string

  /** 每帧渲染前调用 */
  update(context: FrameContext): void

  /** 释放 GPU 资源 */
  dispose?(): void
}
