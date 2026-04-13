import { TextureError } from './BaseError'

/**
 * WebGL 纹理创建失败
 *
 * 使用场景：
 * - gl.createTexture() 返回 null
 * - 纹理对象创建成功但绑定失败
 * - GPU 内存不足
 */
export class TextureCreationError extends TextureError {
  public readonly width?: number
  public readonly height?: number

  constructor(
    textureType: 'TEXTURE_2D' | 'TEXTURE_CUBE_MAP', // 'TEXTURE_2D', 'TEXTURE_CUBE_MAP'
    context?: {
      width?: number
      height?: number
      format?: string
      reason?: string
    }
  ) {
    const message = `Failed to create WebGL texture: ${textureType}`

    super(message, 'TEX_CREATION_FAILED', {
      textureType,
      context,
      recoverable: false
    })

    this.width = context?.width
    this.height = context?.height
  }

  override toUserMessage(): string {
    const size = this.width && this.height ? `${this.width}x${this.height}` : '未知尺寸'

    return `创建 ${size} 纹理失败，可能是GPU内存不足。`
  }
}
