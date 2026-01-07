import { EngineError } from '../BaseError'

/**
 * WebGL 错误基类
 */
export class WebGLError extends EngineError {
  public readonly webglStatusCode: string

  constructor(
    message: string,
    code: string,
    options: {
      context?: Record<string, any>
      recoverable?: boolean
      cause?: Error
    } = {}
  ) {
    super(message, code, options)

    this.webglStatusCode = code
  }
}
