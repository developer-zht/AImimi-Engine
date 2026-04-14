import { FramebufferError } from './BaseError'

export class RenderbufferCreationError extends FramebufferError {
  constructor(width: number, height: number) {
    super(`gl.createRenderbuffer() returned null (${width}x${height})`, 'RBO_CREATION_FAILED', {
      width,
      height,
      recoverable: false
    })
  }
}
