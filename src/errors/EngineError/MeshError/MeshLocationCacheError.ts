import { MeshError } from './BaseError'

// ============================================================
// 3. MeshLocationCacheError - Location 缓存错误
// ============================================================
export class MeshLocationCacheError extends MeshError {
  public readonly attributeName: string
  public readonly shaderProgramName?: string

  constructor(
    attributeName: string,
    message: string,
    meshName: string,
    options: {
      shaderProgramName?: string
      cause?: Error
    } = {}
  ) {
    super(message, 'MESH_LOCATION_CACHE', meshName, {
      context: {
        attributeName,
        shaderProgramName: options.shaderProgramName ?? 'none'
      },
      recoverable: false, // Location 缓存错误通常说明 shader 和 mesh 不匹配
      cause: options.cause
    })

    this.attributeName = attributeName
    this.shaderProgramName = options.shaderProgramName
  }

  override toUserMessage(): string {
    return `在着色器中找不到属性 "${this.attributeName}"。请确保着色器程序正确定义了此属性。`
  }
}
