import { Vec2, Vec3 } from '@/types/math'
import type { ShaderParameters, ShaderProgram } from '@/types/Shader'
import { mat3, mat4 } from 'gl-matrix'

export class Shader {
  private gl: WebGLRenderingContext
  public program: ShaderProgram

  constructor(
    gl: WebGLRenderingContext,
    vertexShaderContent: string,
    fragmentShaderContent: string,
    shaderParameters: ShaderParameters
  ) {
    this.gl = gl
    const vs = this.compileShader(vertexShaderContent, gl.VERTEX_SHADER)
    const fs = this.compileShader(fragmentShaderContent, gl.FRAGMENT_SHADER)

    this.program = this.addShaderLocations(this.linkShader(vs, fs), shaderParameters)
  }

  private compileShader(shaderSource: string, shaderType: GLenum): WebGLShader {
    const shader = this.gl.createShader(shaderType)
    this.gl.shaderSource(shader, shaderSource)
    this.gl.compileShader(shader)

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error(shaderSource)
      console.error('shader compiler error:\n' + this.gl.getShaderInfoLog(shader))
    }

    return shader
  }

  private linkShader(vs: WebGLShader, fs: WebGLShader): WebGLProgram {
    const program = this.gl.createProgram()
    this.gl.attachShader(program, vs)
    this.gl.attachShader(program, fs)
    this.gl.linkProgram(program)

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.log('shader linker error:\n' + this.gl.getProgramInfoLog(program))
      throw new Error('Failed to create program')
    }

    return program
  }

  /**
   * 添加 Shader 中的 attri 和 uniform 的定位
   * @param {WebGLShader} glShaderProgram 已经链接完毕的 shader 对象
   * @param {ShaderParameters} shaderParameters 简单的例子 {uniforms:['uViewMatrix', 'uModelMatrix', 'uProjectionMatrix', 'uCameraPos'],attribs:['aVertexPosition','aNormalPosition','aTextureCoord']}
   * @returns {ShaderProgram}
   */
  private addShaderLocations(
    glShaderProgram: WebGLShader,
    shaderParameters: ShaderParameters
  ): ShaderProgram {
    const result: ShaderProgram = {
      glShaderProgram,
      uniforms: {},
      attribs: {}
    }
    // result.uniforms = {}
    // result.attribs = {}

    if (shaderParameters && shaderParameters.uniforms && shaderParameters.uniforms.length) {
      for (let i = 0; i < shaderParameters.uniforms.length; ++i) {
        result.uniforms = Object.assign(result.uniforms, {
          [shaderParameters.uniforms[i]]: this.gl.getUniformLocation(
            result.glShaderProgram,
            shaderParameters.uniforms[i]
          )
        })
      }
    }
    if (shaderParameters && shaderParameters.attribs && shaderParameters.attribs.length) {
      for (let i = 0; i < shaderParameters.attribs.length; ++i) {
        result.attribs = Object.assign(result.attribs, {
          [shaderParameters.attribs[i]]: this.gl.getAttribLocation(
            result.glShaderProgram,
            shaderParameters.attribs[i]
          )
        })
      }
    }

    return result
  }

  /**
   * 直接设置 uniform 的辅助方法
   * 用于 IBL 预计算等不需要 Material 的场景
   */
  // 使用 shader 程序
  use(): void {
    this.gl.useProgram(this.program.glShaderProgram)
  }

  // 获取 attribute 变量位置
  getAtrributeLocation(name: string): GLint {
    // 优先从缓存中获取
    if (this.program.attribs[name]) {
      return this.program.attribs[name]
    }

    // 如果缓存中没有，动态查询
    const location = this.gl.getAttribLocation(this.program.glShaderProgram, name)
    if (location === -1) {
      console.log(`❌ Attribute '${name}' not found in shader`)
      return location
    }

    // 缓存结果
    this.program.attribs[name] = location
    return location
  }

  // 获取 uniform 变量位置
  // private uniformLocationCache: Map<string, WebGLUniformLocation | null> = new Map() // location 缓存
  private getUniformLocation(name: string): WebGLUniformLocation | null {
    // 优先从缓存中获取
    // if (this.uniformLocationCache.has(name)) {
    //   return this.uniformLocationCache.get(name)
    // }
    if (this.program.uniforms[name]) {
      return this.program.uniforms[name]
    }

    // 如果缓存中没有，动态查询
    const location = this.gl.getUniformLocation(this.program.glShaderProgram, name)

    // if (location !== null) {
    //   this.uniformLocationCache.set(name, location)
    // } else {
    //   console.log(`❌ Uniform '${name}' not found in shader`)
    // }

    if (location === null) {
      console.log(`❌ Uniform '${name}' not found in shader`)
      return location
    }

    // 缓存结果
    this.program.uniforms[name] = location
    return location
  }

  // 设置 4 维矩阵
  setMat4(name: string, value: mat4): void {
    const location = this.getUniformLocation(name)
    if (location !== null) {
      this.gl.uniformMatrix4fv(location, false, value)
    }
  }

  // 设置 3 维矩阵
  setMat3(name: string, value: mat3): void {
    const location = this.getUniformLocation(name)
    if (location !== null) {
      this.gl.uniformMatrix3fv(location, false, value)
    }
  }

  // 设置 3 维向量
  setVec3(name: string, value: Vec3) {
    const location = this.getUniformLocation(name)
    if (location !== null) {
      this.gl.uniform3fv(location, value)
    }
  }

  // 设置 2 维向量
  setVec2(name: string, value: Vec2): void {
    const location = this.getUniformLocation(name)
    if (location !== null) {
      this.gl.uniform2fv(location, value)
    }
  }

  // 设置 float
  setFloat(name: string, value: number): void {
    const location = this.getUniformLocation(name)
    if (location !== null) {
      this.gl.uniform1f(location, value)
    }
  }

  // 设置 int
  setInt(name: string, value: number): void {
    const location = this.getUniformLocation(name)
    if (location !== null) {
      this.gl.uniform1i(location, value)
    }
  }

  // 设置 texture 2D
  setTexture2D(name: string, texture2D: WebGLTexture, unit: number): void {
    const location = this.getUniformLocation(name)
    if (location !== null) {
      this.gl.activeTexture(this.gl.TEXTURE0 + unit)
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture2D)
      this.gl.uniform1i(location, unit)
    }
  }

  // 设置 texture Cube
  setTextureCube(name: string, textureCube: WebGLTexture, unit: number): void {
    const location = this.getUniformLocation(name)
    if (location !== null) {
      this.gl.activeTexture(this.gl.TEXTURE0 + unit)
      this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, textureCube)
      this.gl.uniform1i(location, unit)
    }
  }
}
