import { TextureError } from './BaseError'

/**
 * 纹理资源加载失败
 *
 * 使用场景：
 * - 图片文件加载失败（404、网络错误）
 * - HDR 文件解析失败
 * - 文件格式不支持
 */
export class TextureLoadError extends TextureError {
  public readonly path: string
  public readonly statusCode?: number

  constructor(
    path: string,
    context?: {
      reason?: string
      statusCode?: number
      fileSize?: number
    }
  ) {
    const message = `Failed to load texture from: ${path}`

    super(message, 'TEX_LOAD_FAILED', {
      context: {
        path,
        ...context
      },
      recoverable: true // ✅ 加载失败可以重试
    })

    this.path = path
    this.statusCode = context?.statusCode
  }

  override toUserMessage(): string {
    if (this.statusCode === 404) {
      return `找不到纹理文件：${this.path}`
    }
    if (this.statusCode && this.statusCode >= 500) {
      return `服务器错误，无法加载纹理：${this.path}`
    }
    return `加载纹理失败：${this.path}`
  }
}
