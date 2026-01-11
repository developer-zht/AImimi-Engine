import { WebGLError } from './BaseError'

/**
 * WebGL 不支持错误
 */
export class WebGLNotSupportedError extends WebGLError {
  constructor(message?: string, cause?: Error) {
    super(message ?? 'WebGL is not supported in this browser', 'WEBGL_NOT_SUPPORTED', {
      recoverable: false,
      cause
    })
  }

  override toUserMessage(): string {
    return '您的浏览器不支持 WebGL，请使用 Chrome、Firefox 或 Safari 浏览器。'
  }
}
