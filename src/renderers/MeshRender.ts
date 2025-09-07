import { mat4 } from 'gl-matrix'

import { Mesh } from '@/objects/Mesh'
import { Material } from '@/materials/Material'
import { Shader } from '@/shaders/Shader'
import { PerspectiveCamera } from 'three'

import type { DrawControlParams } from '@/renderers/WebGLRenderer'
import { FFTOceanRenderManager } from '@/managers/fftOcean/FFTOceanRenderManager'
import { UpdatedParamters } from '@/types/WebGLRenderer'

export class MeshRender {
  // public
  public gl: WebGLRenderingContext
  public mesh: Mesh
  public material: Material
  public shader: Shader
  // private
  #vertexBuffer: WebGLBuffer
  #normalBuffer: WebGLBuffer
  #texcoordBuffer: WebGLBuffer
  #indicesBuffer: WebGLBuffer

  private manager: FFTOceanRenderManager | null

  constructor(
    gl: WebGLRenderingContext,
    mesh: Mesh,
    material: Material,
    manager: FFTOceanRenderManager = null
  ) {
    this.gl = gl
    this.mesh = mesh
    this.material = material

    this.#vertexBuffer = this.gl.createBuffer()
    this.#normalBuffer = this.gl.createBuffer()
    this.#texcoordBuffer = this.gl.createBuffer()
    this.#indicesBuffer = this.gl.createBuffer()

    this.manager = manager

    // 处理 Mesh 中的数据
    const extraAttribs = []
    if (mesh.hasVertices) {
      // 提取 Mesh 中的 attri
      extraAttribs.push(mesh.verticesName)
      // 将节点坐标写入显存
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.#vertexBuffer)
      this.gl.bufferData(this.gl.ARRAY_BUFFER, mesh.vertices, this.gl.STATIC_DRAW)
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null)
    }

    if (mesh.hasNormals) {
      // 提取 Mesh 中的 attri
      extraAttribs.push(mesh.normalsName)
      // 将节点法线写入显存
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.#normalBuffer)
      this.gl.bufferData(this.gl.ARRAY_BUFFER, mesh.normals, this.gl.STATIC_DRAW)
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null)
    }

    if (mesh.hasTexcoords) {
      // 提取 Mesh 中的 attri
      extraAttribs.push(mesh.texcoordsName)
      // 将节点纹理坐标写入显存
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.#texcoordBuffer)
      this.gl.bufferData(this.gl.ARRAY_BUFFER, mesh.texcoords, this.gl.STATIC_DRAW)
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null)
    }

    // 将节点索引写入显存
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.#indicesBuffer)
    this.gl.bufferData(
      this.gl.ELEMENT_ARRAY_BUFFER,
      // new Uint16Array(mesh.indices),
      mesh.indicesData,
      this.gl.STATIC_DRAW
    )
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null)

    // console.log(extraAttribs)

    // 将 vertex 中包含的所有 atrri 写入 material 中的 flatten_attribs 属性
    this.material.setMeshAttribs(extraAttribs)

    // 此时 material 中的 flatten_attribs 和 flatten_uniforms 已经准备完毕，可以创建对应的 shader 了
    this.shader = this.material.compile(this.gl)
  }

  // 启动 vertex 的 vertices、normals、texture coordinates 属性
  // 绑定索引数据 indices
  bindGeometryInfo() {
    const gl = this.gl

    if (this.mesh.hasVertices) {
      const numComponents = 3
      const type = this.gl.FLOAT
      const normalize = false
      const stride = 0
      const offset = 0
      gl.bindBuffer(gl.ARRAY_BUFFER, this.#vertexBuffer)
      gl.vertexAttribPointer(
        this.shader.program.attribs[this.mesh.verticesName],
        numComponents,
        type,
        normalize,
        stride,
        offset
      )
      gl.enableVertexAttribArray(this.shader.program.attribs[this.mesh.verticesName])
    }

    if (this.mesh.hasNormals && this.shader.program.attribs[this.mesh.normalsName] >= 0) {
      const numComponents = 3
      const type = this.gl.FLOAT
      const normalize = false
      const stride = 0
      const offset = 0
      gl.bindBuffer(this.gl.ARRAY_BUFFER, this.#normalBuffer)
      gl.vertexAttribPointer(
        this.shader.program.attribs[this.mesh.normalsName],
        numComponents,
        type,
        normalize,
        stride,
        offset
      )
      gl.enableVertexAttribArray(this.shader.program.attribs[this.mesh.normalsName])
    }

    if (this.mesh.hasTexcoords && this.shader.program.attribs[this.mesh.texcoordsName] >= 0) {
      const numComponents = 2
      const type = this.gl.FLOAT
      const normalize = false
      const stride = 0
      const offset = 0
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.#texcoordBuffer)
      this.gl.vertexAttribPointer(
        this.shader.program.attribs[this.mesh.texcoordsName],
        numComponents,
        type,
        normalize,
        stride,
        offset
      )
      gl.enableVertexAttribArray(this.shader.program.attribs[this.mesh.texcoordsName])
    }

    gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.#indicesBuffer)
  }

  // 修改（写入） shader 中的 MVP 矩阵和 uCameraPos 相机位置等 uniform 变量
  bindCameraParameters(camera: PerspectiveCamera) {
    const gl = this.gl

    const modelMatrix = mat4.create()
    const viewMatrix = mat4.create()
    const projectionMatrix = mat4.create()
    // Model transform
    mat4.identity(modelMatrix)
    mat4.translate(modelMatrix, modelMatrix, this.mesh.transform.translate)
    mat4.scale(modelMatrix, modelMatrix, this.mesh.transform.scale)
    mat4.rotateX(modelMatrix, modelMatrix, this.mesh.transform.rotate[0])
    mat4.rotateY(modelMatrix, modelMatrix, this.mesh.transform.rotate[1])
    mat4.rotateZ(modelMatrix, modelMatrix, this.mesh.transform.rotate[2])

    // View transform
    camera.updateMatrixWorld()
    mat4.invert(viewMatrix, camera.matrixWorld.elements)
    // Projection transform
    mat4.copy(projectionMatrix, camera.projectionMatrix.elements)

    gl.uniformMatrix4fv(this.shader.program.uniforms.uProjectionMatrix, false, projectionMatrix)
    gl.uniformMatrix4fv(this.shader.program.uniforms.uModelMatrix, false, modelMatrix)
    gl.uniformMatrix4fv(this.shader.program.uniforms.uViewMatrix, false, viewMatrix)
    // console.log(camera.position)

    gl.uniform3fv(this.shader.program.uniforms.uCameraPos, [
      camera.position.x,
      camera.position.y,
      camera.position.z
    ])
  }

  /**
   * 利用 material 修改（写入）shader 中的 uniform 数据
   * @param {Record<string, WebGLUniformLocation>} this.shader.program.uniforms 简单举例 {name:uniformLocation}，因此 this.shader.program.uniforms[k] 就是 uniformLocation
   */
  bindMaterialParameters(drawControlParams: DrawControlParams) {
    const gl = this.gl

    // let textureNum = drawControlParams.globalTextureNum
    for (const k in this.material.uniforms) {
      if (this.material.uniforms[k].type == 'matrix4fv') {
        gl.uniformMatrix4fv(this.shader.program.uniforms[k], false, this.material.uniforms[k].value)
      } else if (this.material.uniforms[k].type == '3fv') {
        gl.uniform3fv(this.shader.program.uniforms[k], this.material.uniforms[k].value)
      } else if (this.material.uniforms[k].type == '2fv') {
        gl.uniform2fv(this.shader.program.uniforms[k], this.material.uniforms[k].value)
      } else if (this.material.uniforms[k].type == '1f') {
        gl.uniform1f(this.shader.program.uniforms[k], this.material.uniforms[k].value)
      } else if (this.material.uniforms[k].type == '3iv') {
        gl.uniform3iv(this.shader.program.uniforms[k], this.material.uniforms[k].value)
      } else if (this.material.uniforms[k].type == '2iv') {
        gl.uniform2iv(this.shader.program.uniforms[k], this.material.uniforms[k].value)
      } else if (this.material.uniforms[k].type == '1i') {
        gl.uniform1i(this.shader.program.uniforms[k], this.material.uniforms[k].value)
      } else if (this.material.uniforms[k].type == 'texture') {
        // gl.activeTexture(this.gl.TEXTURE0 + textureNum)
        // gl.bindTexture(this.gl.TEXTURE_2D, this.material.uniforms[k].value)
        // gl.uniform1i(this.shader.program.uniforms[k], textureNum)
        // textureNum += 1
        if (this.material.uniforms[k].value && this.material.uniforms[k].value !== null) {
          // console.log(k, this.material.uniforms[k], this.shader.program.uniforms[k])
          gl.activeTexture(this.gl.TEXTURE0 + drawControlParams.globalTextureNum)
          gl.bindTexture(this.gl.TEXTURE_2D, this.material.uniforms[k].value)
          gl.uniform1i(this.shader.program.uniforms[k], drawControlParams.globalTextureNum)
          drawControlParams.globalTextureNum += 1
        } else {
          // 不增加 drawControlParams.globalTextureNum，也不绑定纹理
          console.warn(`跳过null值的立方体贴图: ${k}`)
        }
      } else if (this.material.uniforms[k].type == 'textureCube') {
        // gl.activeTexture(this.gl.TEXTURE0 + textureNum)
        // gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.material.uniforms[k].value)
        // gl.uniform1i(this.shader.program.uniforms[k], textureNum)
        // textureNum += 1
        // 检查纹理值是否有效
        if (this.material.uniforms[k].value && this.material.uniforms[k].value !== null) {
          // console.log(this.material.uniforms[k].value)
          gl.activeTexture(this.gl.TEXTURE0 + drawControlParams.globalTextureNum)
          gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.material.uniforms[k].value)
          // console.log(drawControlParams.globalTextureNum)
          // console.log(this.shader.program.uniforms[k])
          gl.uniform1i(this.shader.program.uniforms[k], drawControlParams.globalTextureNum)
          drawControlParams.globalTextureNum += 1
        } else {
          // 不增加 drawControlParams.globalTextureNum，也不绑定纹理
          console.warn(`跳过null值的立方体贴图: ${k}`)
        }
      }
    }
  }

  updateMaterialParameters(parameters: UpdatedParamters) {
    if (parameters == null) {
      return
    }
    for (const k in this.material.uniforms) {
      if (k in parameters) {
        this.material.uniforms[k].value = parameters[k]
      }
    }
  }

  draw(
    camera: PerspectiveCamera,
    gl_draw_buffers: WEBGL_draw_buffers,
    fbo: WebGLFramebuffer | null,
    updatedParamters: UpdatedParamters,
    drawControlParams: DrawControlParams
  ) {
    const gl = this.gl

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.viewport(0.0, 0.0, window.screen.width, window.screen.height)
    if (fbo != null) {
      gl_draw_buffers.drawBuffersWEBGL(fbo.attachments)
    }
    gl.useProgram(this.shader.program.glShaderProgram)

    // Bind geometry information
    this.bindGeometryInfo()

    // Bind Camera parameters
    this.bindCameraParameters(camera)

    if (this.manager) {
      this.manager.update(updatedParamters.uTime)
      // console.log(this.manager)
    }

    // Bind material parameters
    this.updateMaterialParameters(updatedParamters)
    this.bindMaterialParameters(drawControlParams)

    // Draw
    {
      const vertexCount = this.mesh.count
      // const type = gl.UNSIGNED_SHORT // 启动了 OES_element_index_uint 扩展，别忘记把 indices 的类型改成 gl.UNSIGNED_INT
      const type = gl.UNSIGNED_INT
      const offset = 0
      gl.drawElements(gl.TRIANGLES, vertexCount, type, offset) // 三角形方式渲染
      // gl.drawElements(gl.LINES, vertexCount, type, offset) // 线型方式渲染
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }
}
