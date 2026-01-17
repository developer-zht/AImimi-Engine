import { ShaderTpye } from '@/shaders/types/Shader'
import { ShaderError } from './BaseError'

/**
 * 着色器编译错误
 */
export class ShaderCompilationError extends ShaderError {
  public readonly compileLog: string

  constructor(
    shaderType: ShaderTpye,
    shaderPath: string,
    compileLog: string,
    context?: {
      shaderSource?: string
      line?: number
    }
  ) {
    super(`Shader compilation failed: ${shaderPath}`, 'SHADER_COMPILATION_FAILED', {
      shaderType,
      shaderPath,
      context: {
        compileLog,
        ...context
      },
      recoverable: false
    })

    this.compileLog = compileLog
  }

  override toUserMessage(): string {
    const typeNames = {
      vertex: '顶点着色器',
      fragment: '片段着色器',
      compute: '计算着色器'
    }

    const typeName = this.shaderType ? typeNames[this.shaderType] : '着色器'
    return `${typeName}编译失败：${this.shaderPath}\n${this.compileLog}`
  }
}
