import { EngineError } from '../BaseError'

/**
 * 着色器编译错误
 */
export class ShaderCompilationError extends EngineError {
  public readonly shaderType: 'vertex' | 'fragment'
  public readonly shaderPath: string
  public readonly compileLog: string

  constructor(shaderType: 'vertex' | 'fragment', shaderPath: string, compileLog: string) {
    super(`Shader compilation failed: ${shaderPath}`, 'SHADER_COMPILATION_FAILED', {
      context: {
        shaderType,
        shaderPath,
        compileLog
      },
      recoverable: false
    })

    this.shaderType = shaderType
    this.shaderPath = shaderPath
    this.compileLog = compileLog
  }

  override toUserMessage(): string {
    return `着色器编译失败：${this.shaderPath}\n${this.compileLog}`
  }
}
