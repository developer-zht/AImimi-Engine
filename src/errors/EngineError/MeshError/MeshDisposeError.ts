import { MeshError } from './BaseError'

// ============================================================
// ⚠️ Mesh 的 dispose() 方法几乎不会发生错误，因此该错误可以删除

// MeshDisposeError - Mesh 清理错误
// ============================================================
export class MeshDisposeError extends MeshError {
  constructor(
    message: string,
    meshName: string,
    options: {
      cause?: Error
    }
  ) {
    super(message, 'MESH_DISPOSE', meshName, {
      cause: options.cause
    })
  }

  override toUserMessage(): string {
    return '清理网格资源失败。这可能导致内存泄漏。'
  }
}
