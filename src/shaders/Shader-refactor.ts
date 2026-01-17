// ============================================================
// Shader 类（只负责编译和工具方法）

import { HttpError } from '@/errors/EngineError/NetworkError/HTTPError'
import { NetworkTimeoutError } from '@/errors/EngineError/NetworkError/NetworkTimeoutError'
import { ShaderLoadError } from '@/errors/EngineError/ShaderError/ShaderLoadError'
import { fetchTextWithTimeout } from '@/network/fetch-text'
import { ShaderCode, ShaderFile, ShaderTpye } from './types/Shader'
import { ShaderCreationError } from '@/errors/EngineError/ShaderError/ShaderCreationError'
import { ShaderCompilationError } from '@/errors/EngineError/ShaderError/ShaderCompilationError'
import { ShaderLinkError } from '@/errors/EngineError/ShaderError/ShaderLinkError'

// ============================================================
export class Shader {
  private gl: WebGLRenderingContext
  public readonly program: WebGLProgram

  constructor(gl: WebGLRenderingContext, program: WebGLProgram) {
    this.gl = gl
    this.program = program
  }

  /**
   * 工具方法：获取 attribute location
   */
  getAttribLocation(name: string): number {
    return this.gl.getAttribLocation(this.program, name)
  }

  /**
   * 工具方法：获取 uniform location
   */
  getUniformLocation(name: string): WebGLUniformLocation | null {
    return this.gl.getUniformLocation(this.program, name)
  }

  /**
   * 静态方法：工厂方法创建 Shader 实例
   */
  static async createShader(
    gl: WebGLRenderingContext,
    vertexShaderPath: string,
    fragmentShaderPath: string
  ) {
    const shaderFile = await Shader.loadShaderFiles(vertexShaderPath, fragmentShaderPath)

    const program = Shader.createProgram(gl, shaderFile)

    return new Shader(gl, program)
  }

  /**
   * 静态方法：加载并字符串化 shader
   */
  static async loadShaderFiles(
    vertexShaderPath: string,
    fragmentShaderPath: string
  ): Promise<ShaderFile> {
    const shaderCode: ShaderCode = {
      vShaderCode: '',
      fShaderCode: ''
    }

    // 加载顶点着色器
    try {
      shaderCode.vShaderCode = await fetchTextWithTimeout(vertexShaderPath)
    } catch (error) {
      throw Shader.wrapLoadError(error, 'vertex', vertexShaderPath)
    }

    // 加载片段着色器
    try {
      shaderCode.fShaderCode = await fetchTextWithTimeout(fragmentShaderPath)
    } catch (error) {
      throw Shader.wrapLoadError(error, 'fragment', fragmentShaderPath)
    }

    const shaderFile: ShaderFile = {
      ...shaderCode,
      vShaderPath: vertexShaderPath,
      fShaderPath: fragmentShaderPath
    }
    return shaderFile
  }

  /**
   * 静态方法：从代码编译并链接 shader
   */
  static createProgram(gl: WebGLRenderingContext, shaderFile: ShaderFile): WebGLProgram {
    // 编译顶点着色器
    const vShader = gl.createShader(gl.VERTEX_SHADER)
    if (!vShader) throw new ShaderCreationError('vertex')
    gl.shaderSource(vShader, shaderFile.vShaderCode)

    if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
      throw new ShaderCompilationError(
        'vertex',
        shaderFile.vShaderPath,
        gl.getShaderInfoLog(vShader) ?? 'vertex shader compilation failed'
      )
    }

    // 编译片段着色器
    const fShader = gl.createShader(gl.FRAGMENT_SHADER)
    if (!fShader) throw new ShaderCreationError('fragment')
    gl.shaderSource(fShader, shaderFile.fShaderCode)

    if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
      throw new ShaderCompilationError(
        'fragment',
        shaderFile.fShaderPath,
        gl.getShaderInfoLog(fShader) ?? 'fragment shader compilation failed'
      )
    }

    // 链接程序
    const program = gl.createProgram()
    gl.attachShader(program, vShader)
    gl.attachShader(program, fShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new ShaderLinkError(`${shaderFile.vShaderPath} & ${shaderFile.fShaderPath}`, 'program')
    }

    // 清理
    gl.deleteShader(vShader)
    gl.deleteShader(fShader)

    return program
  }

  /**
   * 包装 load 错误
   */
  private static wrapLoadError(error: unknown, shaderType: ShaderTpye, shaderPath: string) {
    // HTTP 错误
    if (error instanceof HttpError) {
      return new ShaderLoadError(error.url, shaderType, {
        reason: `HTTP ${error.httpStatus}: ${error.statusText}`,
        statusCode: error.httpStatus
      })
    }

    // 超时错误
    if (error instanceof NetworkTimeoutError) {
      return new ShaderLoadError(error.url, shaderType, {
        reason: `Timeout after ${error.timeout}ms`,
        timeout: error.timeout
      })
    }

    // 其他错误
    return new ShaderLoadError(shaderPath, shaderType, {
      reason: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
