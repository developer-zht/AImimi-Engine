import { EngineError } from '../BaseError'

export abstract class LightError extends EngineError {
  constructor(
    message: string,
    code: string,
    options: { context?: Record<string, any>; recoverable?: boolean; cause?: Error } = {}
  ) {
    super(message, code, options)
  }
}
