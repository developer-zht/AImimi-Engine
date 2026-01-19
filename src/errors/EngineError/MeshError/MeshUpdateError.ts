import { MeshError } from './BaseError'
import { MeshUpdateErrorReason } from './types/MeshUpdateError'

// ============================================================
//  MeshUpdateError - Mesh 更新错误
// ============================================================
export class MeshUpdateError extends MeshError {
  public readonly attributeName: string
  public readonly reason: MeshUpdateErrorReason

  constructor(
    attributeName: string,
    reason: MeshUpdateErrorReason,
    message: string,
    meshName: string,
    options: {
      cause?: Error
    }
  ) {
    super(message, `MESH_UPDATE_${reason.toUpperCase()}`, meshName, {
      context: {
        attributeName,
        reason
      },
      recoverable: reason === 'update_failed',
      cause: options.cause
    })

    this.attributeName = attributeName
    this.reason = reason
  }

  override toUserMessage(): string {
    const reasonMessages: Record<MeshUpdateErrorReason, string> = {
      vbo_not_created: 'VBO 尚未创建',
      attribute_not_found: '属性未找到',
      data_length_mismatch: '数据长度不匹配',
      update_failed: '更新失败'
    }

    return `更新网格属性 "${this.attributeName}" 失败：${reasonMessages[this.reason]}。`
  }
}
