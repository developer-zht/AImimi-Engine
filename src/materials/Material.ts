import { Shader } from '@/shaders/Shader-refactor'

import { UniformEntry, UniformType, type Uniforms } from '@/materials/types/Material'
import { assertNever } from '@/errors/helper/helpers'

export class Material {
  static idCount = 0 // 当前 Material 对象的编号计数器，保证 id 和 name 的唯一性
  private id: number // 当前 Material 对象的编号，保证 name 的唯一性

  public readonly name: string
  public uniforms: Uniforms
  public frameBuffer: WebGLFramebuffer | null

  private uniformLocationCache: Map<string, WebGLUniformLocation | null> = new Map()

  constructor(name: string, uniforms: Uniforms, frameBuffer?: WebGLFramebuffer | null) {
    this.id = Material.idCount++ // 与 C++ 一致，等价于 this.id = Material.idCount & Material.idCount++

    this.name = `${name}#${this.id}`
    this.uniforms = uniforms // 留给 MeshRender.bindMaterialParameters() 函数使用的
    this.frameBuffer = frameBuffer ?? null
  }

  /**
   * 首次使用时缓存所有 uniform location
   */
  cacheUniformLocations(shader: Shader) {
    this.uniformLocationCache.clear()
    for (const [name] of Object.entries(this.uniforms)) {
      const location = shader.getUniformLocation(name)
      this.uniformLocationCache.set(name, location)
    }
  }

  /** 为单个 uniform 补缓存 location（用于运行时动态新增的 uniform） */
  cacheUniformLocation(shader: Shader, name: string): void {
    if (!this.uniformLocationCache.has(name)) {
      this.uniformLocationCache.set(name, shader.getUniformLocation(name))
    }
  }

  /**
   * 将所有 uniform 写入 GPU
   */
  applyUniforms(
    gl: WebGLRenderingContext,
    shader: Shader,
    textureUnitStart: number // 当前可用的纹理单元起始编号
  ): number {
    let textureUnit = textureUnitStart
    // console.debug(textureUnit)
    // console.debug(this.uniforms)

    for (const [name, entry] of Object.entries(this.uniforms)) {
      let location: WebGLUniformLocation | null = null
      const cachedLoc = this.uniformLocationCache.get(name)
      if (cachedLoc) {
        // console.debug('[Material applyUniforms] cached')
        location = cachedLoc
      } else {
        location = shader.getUniformLocation(name)
      }
      if (!location) continue // shader 中不使用此 uniform，正常跳过

      // console.debug(name, ': ', entry)

      switch (entry.type) {
        case UniformType.ONE_I:
          gl.uniform1i(location, entry.value)
          break
        case UniformType.ONE_F:
          gl.uniform1f(location, entry.value)
          break
        case UniformType.TWO_IV:
          gl.uniform2iv(location, entry.value)
          break
        case UniformType.TWO_FV:
          gl.uniform2fv(location, entry.value)
          break
        case UniformType.THREE_IV:
          gl.uniform3iv(location, entry.value)
          break
        case UniformType.THREE_FV:
          gl.uniform3fv(location, entry.value)
          break
        case UniformType.FOUR_IV:
          gl.uniform4iv(location, entry.value)
          break
        case UniformType.FOUR_FV:
          gl.uniform4fv(location, entry.value)
          break
        case UniformType.MATRIX_3FV:
          gl.uniformMatrix3fv(location, false, entry.value)
          break
        case UniformType.MATRIX_4FV:
          gl.uniformMatrix4fv(location, false, entry.value)
          break
        case UniformType.TEXTURE_2D:
          // if (entry.value !== null) {
          //   gl.activeTexture(gl.TEXTURE0 + textureUnit)
          //   gl.bindTexture(gl.TEXTURE_2D, entry.value)
          //   gl.uniform1i(location, textureUnit)
          //   textureUnit++
          // }
          gl.activeTexture(gl.TEXTURE0 + textureUnit)
          if (entry.value !== null) {
            gl.bindTexture(gl.TEXTURE_2D, entry.value)
          }
          gl.uniform1i(location, textureUnit)
          textureUnit++
          break
        case UniformType.TEXTURE_CUBE:
          // if (entry.value !== null) {
          //   gl.activeTexture(gl.TEXTURE0 + textureUnit)
          //   gl.bindTexture(gl.TEXTURE_CUBE_MAP, entry.value)
          //   gl.uniform1i(location, textureUnit)
          //   textureUnit++
          // }
          gl.activeTexture(gl.TEXTURE0 + textureUnit)
          if (entry.value !== null) {
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, entry.value)
          }
          gl.uniform1i(location, textureUnit)
          textureUnit++
          break

        default: {
          const _exhaustive: never = entry
          assertNever(_exhaustive)
        }
      }
    }

    return textureUnit
  }

  // =============== helper ===============
  getUniformValue(name: string): UniformEntry['value'] | undefined {
    return this.uniforms[name]?.value
  }

  hasUniform(name: string): boolean {
    return name in this.uniforms
  }
}
