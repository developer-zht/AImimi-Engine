import { EngineError } from '../BaseError'

export class MeshError extends EngineError {
  public readonly meshName: string

  constructor(
    message: string,
    code: string,
    meshName: string,
    options: {
      context?: Record<string, any>
      cause?: Error
      recoverable?: boolean
    }
  ) {
    super(message, code, {
      context: {
        meshName: meshName,
        ...options.context
      },
      recoverable: options.recoverable,
      cause: options.cause
    })

    this.meshName = meshName
  }
}
