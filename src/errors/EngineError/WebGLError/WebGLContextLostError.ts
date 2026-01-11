import { WebGLError } from './BaseError'

/**
 * WebGL 上下文丢失错误
 */
export class WebGLContextLostError extends WebGLError {
  constructor() {
    super(
      'WebGL context was lost',
      'WEBGL_CONTEXT_LOST',
      { recoverable: true } // 可以尝试恢复
    )
  }

  override toUserMessage(): string {
    return '渲染上下文已丢失，正在尝试恢复...'
  }
}
