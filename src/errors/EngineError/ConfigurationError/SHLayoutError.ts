import { ConfigurationError } from './BaseError'

export type SHLayoutErrorType =
  | 'invalid_coeffs_count' // coeffsPerChannel 不是完美平方数
  | 'unsupported_uniform_type' // uniformType 不支持
  | 'layout_mismatch' // coeffsPerChannel 与 uniformType 不匹配
  | 'data_mismatch' // 运行时数据与 layout 不匹配

export class SHLayoutError extends ConfigurationError {
  public readonly errorType: SHLayoutErrorType

  constructor(errorType: SHLayoutErrorType, message: string, context?: Record<string, unknown>) {
    super(message, 'SH_LAYOUT_ERROR', { context: { errorType, ...context } })
    this.errorType = errorType
  }

  override toUserMessage(): string {
    const hints: Record<SHLayoutErrorType, string> = {
      invalid_coeffs_count: 'SH 系数个数必须是 (order+1)² 的形式，如 4、9、16',
      unsupported_uniform_type: '当前仅支持 mat3 (9 coeffs) 和 mat4 (16 coeffs)',
      layout_mismatch: 'SH 系数个数与 uniform 类型不匹配',
      data_mismatch: '运行时 lightSH 数据与声明的 layout 不一致'
    }
    return hints[this.errorType] ?? this.message
  }
}
