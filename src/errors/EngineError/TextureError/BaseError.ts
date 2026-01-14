import { EngineError } from '../BaseError'

export class TextureError extends EngineError {
  public readonly textureType?: string

  constructor(
    message: string,
    code: string,
    options: {
      textureType?: string
      context?: Record<string, any>
      recoverable?: boolean
      cause?: Error
    } = {}
  ) {
    super(message, code, {
      context: {
        textureType: options.textureType,
        ...options.context
      },
      recoverable: options.recoverable,
      cause: options.cause
    })

    this.textureType = options.textureType
  }
}
