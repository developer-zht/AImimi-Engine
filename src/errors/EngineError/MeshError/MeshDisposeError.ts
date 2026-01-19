import { MeshError } from './BaseError'

// ============================================================
//  MeshDisposeError - Mesh 清理错误
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
