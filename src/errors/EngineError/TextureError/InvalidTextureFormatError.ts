import { TextureError } from './BaseError'

/**
 * 纹理格式错误
 *
 * 使用场景：
 * - HDR 数据必须是 Float32Array，但传入了其他类型
 * - 纹理尺寸不符合要求（如：必须是2的幂）
 * - 纹理格式不支持（如：RGB vs RGBA）
 */
export class InvalidTextureFormatError extends TextureError {
  public readonly expectedFormat?: string
  public readonly actualFormat?: string

  constructor(
    message: string,
    context?: {
      expectedFormat?: string
      actualFormat?: string
      expectedType?: string
      actualType?: string
      width?: number
      height?: number
      requirement?: string
      reason?: string
    }
  ) {
    super(message, 'TEX_INVALID_FORMAT', {
      context,
      recoverable: false
    })

    this.expectedFormat = context?.expectedFormat
    this.actualFormat = context?.actualFormat
  }

  override toUserMessage(): string {
    if (this.context?.expectedType && this.context?.actualType) {
      return `纹理数据格式错误：期望 ${this.context.expectedType}，实际为 ${this.context.actualType}`
    }
    return '纹理数据格式不正确，请检查数据类型。'
  }
}
