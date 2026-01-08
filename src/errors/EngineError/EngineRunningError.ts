import { EngineError } from '../BaseError'

export class EngineRunningError extends EngineError {
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
  }
}
