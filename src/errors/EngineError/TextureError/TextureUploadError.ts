import { TextureError } from './BaseError'

/**
 * 纹理上传到 GPU 失败
 *
 * 使用场景：
 * - gl.texImage2D() 失败
 * - 数据大小不匹配
 * - GPU 内存不足
 */
export class TextureUploadError extends TextureError {
  public readonly width?: number
  public readonly height?: number
  public readonly format?: string

  constructor(
    message: string,
    context?: {
      textureType?: string
      width?: number
      height?: number
      format?: string
      dataSize?: number
      expectedSize?: number
      reason?: string
    }
  ) {
    super(message, 'TEX_UPLOAD_FAILED', {
      context,
      recoverable: false
    })

    this.width = context?.width
    this.height = context?.height
    this.format = context?.format
  }

  override toUserMessage(): string {
    const size = this.width && this.height ? `${this.width}x${this.height}` : '未知尺寸'

    if (this.context?.reason && (this.context.reason as string).includes('OUT_OF_MEMORY')) {
      return `GPU内存不足，无法上传 ${size} 纹理。`
    }

    if (this.context?.dataSize && this.context?.expectedSize) {
      return `纹理数据大小不匹配（期望 ${this.context.expectedSize}，实际 ${this.context.dataSize}）`
    }

    return `上传纹理到GPU失败：${size}`
  }
}
