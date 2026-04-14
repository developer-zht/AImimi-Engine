import { FramebufferError } from './BaseError'

export class FramebufferCreationError extends FramebufferError {
  constructor(
    width: number,
    height: number,
    options?: {
      reason?: string
      context?: Record<string, any> | undefined
      cause?: Error
    }
  ) {
    const message = options?.reason ?? `gl.createFramebuffer() returned null (${width}x${height})`
    super(message, 'FBO_CREATION_FAILED', {
      width,
      height,
      recoverable: false,
      context: options?.context,
      cause: options?.cause
    })
  }
}
