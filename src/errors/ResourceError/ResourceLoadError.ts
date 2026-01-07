import { EngineError } from '../BaseError'

/**
 * 资源加载错误
 */
export class ResourceLoadError extends EngineError {
  public readonly resourceType: string
  public readonly resourcePath: string

  constructor(
    resourceType: string,
    resourcePath: string,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(`Failed to load ${resourceType}: ${resourcePath}`, 'RESOURCE_LOAD_FAILED', {
      context: {
        resourceType,
        resourcePath,
        ...context
      },
      recoverable: false,
      cause
    })

    this.resourceType = resourceType
    this.resourcePath = resourcePath
  }

  override toUserMessage(): string {
    const typeNames: Record<string, string> = {
      texture: '纹理',
      shader: '着色器',
      model: '模型',
      hdr: 'HDR环境贴图'
    }

    const typeName = typeNames[this.resourceType] || this.resourceType
    return `加载${typeName}失败：${this.resourcePath}`
  }
}
