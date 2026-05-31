import { CubemapFBO } from '@/framebuffers/CubemapFBO'
import { Shader } from '@/shaders/Shader'

export interface RenderToCubemapConfig {
  cubemapFBO: CubemapFBO
  shader: Shader
  /**
   * 在所有面渲染前调用一次（绑定纹理输入、设置常量 uniform）
   */
  setupCommonUniforms?: (shader: Shader) => void
  /**
   * 每个面渲染前调用一次（face-specific uniform）
   */
  setupSpecificUniforms?: (shader: Shader, faceIndex: number) => void
  /**
   * 是否清深度（默认 true）
   */
  clearDepth?: boolean
}
