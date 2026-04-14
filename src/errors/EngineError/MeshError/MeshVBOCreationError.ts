import { MeshError } from './BaseError'

// ============================================================
// MeshVBOCreationError - VBO 创建错误
// ============================================================
export class MeshVBOCreationError extends MeshError {
  public readonly bufferType: 'vbo' | 'ibo'
  public readonly attributeName?: string

  constructor(
    bufferType: 'vbo' | 'ibo',
    message: string,
    meshName: string,
    options: {
      attributeName?: string
      cause?: Error
    } = {}
  ) {
    super(message, `MESH_VBO_CREATION_${bufferType.toUpperCase()}`, meshName, {
      context: {
        attributeName: options.attributeName ?? 'ibo(no attribute name)'
      },
      recoverable: true, // VBO 创建失败可能是临时性的（如 WebGL 上下文丢失）
      cause: options.cause
    })

    this.bufferType = bufferType
    this.attributeName = options.attributeName
  }

  override toUserMessage(): string {
    if (this.bufferType === 'vbo' && this.attributeName) {
      return `创建顶点缓冲区失败（属性：${this.attributeName}）。这可能是由于显卡内存不足或 WebGL 上下文丢失。请尝试刷新页面或降低场景复杂度。`
    }

    if (this.bufferType === 'ibo') {
      return '创建索引缓冲区失败。这可能是由于显卡内存不足或 WebGL 上下文丢失。请尝试刷新页面或降低场景复杂度。'
    }

    return '创建缓冲区失败。请尝试刷新页面或降低场景复杂度。'
  }
}
