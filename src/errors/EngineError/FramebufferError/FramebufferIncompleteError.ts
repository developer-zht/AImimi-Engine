import { FramebufferError } from './BaseError'

export class FramebufferIncompleteError extends FramebufferError {
  public readonly framebufferStatus: number

  constructor(status: number, width: number, height: number, colorAttachmentCount: number) {
    super(
      `Framebuffer incomplete: status ${status} (${width}x${height}, ${colorAttachmentCount} attachments)`,
      'FBO_INCOMPLETE',
      {
        width,
        height,
        context: {
          framebufferStatus: status,
          colorAttachmentCount
        },
        recoverable: false
      }
    )
    this.framebufferStatus = status
  }

  override toUserMessage(): string {
    return `创建 ${this.width}x${this.height} 帧缓冲失败（状态码: ${this.framebufferStatus}），可能是 GPU 不支持此配置。`
  }
}
