import { MeshError } from './BaseError'
import { MeshValidationErrorType } from './types/MeshValidationError'

// ============================================================
// MeshValidationError - Mesh 验证错误
// ============================================================
export class MeshValidationError extends MeshError {
  public readonly validationType: MeshValidationErrorType

  public readonly details?: Record<string, unknown>

  constructor(
    validationType: MeshValidationErrorType,
    message: string,
    meshName: string,
    options: { details?: Record<string, unknown>; cause?: Error } = {}
  ) {
    super(message, `MESH_VALIDATION_${validationType.toUpperCase()}`, meshName, {
      cause: options.cause,
      recoverable: false // 验证错误通常不可恢复
    })

    this.validationType = validationType
    this.details = options.details
  }

  override toUserMessage(): string {
    const typeMessages: Record<MeshValidationErrorType, string> = {
      empty_attribute: '网格属性数据为空',
      empty_indices: '网格索引数据为空',
      invalid_attribute_size: '网格属性大小无效',
      attribute_length_mismatch: '网格属性长度不匹配',
      inconsistent_vertex_count: '网格顶点数不一致',
      index_out_of_range: '网格索引超出范围',
      invalid_index_count: '网格索引数量无效',
      invalid_parameter: '网格参数无效'
    }

    return `网格验证失败：${typeMessages[this.validationType]}。请检查网格数据的正确性。`
  }
}
