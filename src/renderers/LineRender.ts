import { mat4 } from 'gl-matrix'

import { Mesh } from '@/objects/Mesh'
import { Material } from '@/materials/Material'
import { Shader } from '@/shaders/Shader'
import { PerspectiveCamera } from 'three'

import type { DrawControlParams } from '@/renderers/WebGLRenderer'
import { FFTOceanRenderManager } from '@/managers/fftOcean/FFTOceanRenderManager'
import { UpdatedParamters } from '@/types/WebGLRenderer'

export enum LineRenderMode {
  LINES = 'LINES', // 基本线段
  LINE_STRIP = 'LINE_STRIP', // 连续线条
  LINE_LOOP = 'LINE_LOOP' // 闭合线条
}

export class LineRender {
  // public
  public gl: WebGLRenderingContext
  public mesh: Mesh
  public material: Material
  public shader: Shader
  public renderMode: LineRenderMode
  // private
  private indicesBuffer: WebGLBuffer

  private manager: FFTOceanRenderManager | null

  public attributeBuffers: Map<string, WebGLBuffer> = new Map()

  constructor(
    gl: WebGLRenderingContext,
    mesh: Mesh,
    material: Material,
    renderMode: LineRenderMode,
    manager: FFTOceanRenderManager = null
  ) {
    this.gl = gl
    this.mesh = mesh
    this.material = material
    this.renderMode = renderMode

    this.manager = manager

    this.createAttributeBuffers()

    // 将 vertex 中包含的所有 atrri 写入 material 中的 flatten_attribs 属性
    this.material.setMeshAttribs(this.mesh.getAttributeNames())

    // 此时 material 中的 flatten_attribs 和 flatten_uniforms 已经准备完毕，可以创建对应的 shader 了
    this.shader = this.material.compile(this.gl)
  }

  // 获取渲染类型
  private getWebGLDrawMode(): GLenum {
    const gl = this.gl
    switch (this.renderMode) {
      case LineRenderMode.LINES:
        return gl.LINES
      case LineRenderMode.LINE_LOOP:
        return gl.LINE_LOOP
      case LineRenderMode.LINE_STRIP:
        return gl.LINE_STRIP
      default:
        return gl.LINES
    }
  }

  // 从外部设置渲染类型
  setRenderMode(renderMode: LineRenderMode) {
    this.renderMode = renderMode
  }

  private createAttributeBuffers() {
    // 创建 attribute buffer
    for (const [name, attributeData] of this.mesh.attributes) {
      const buffer = this.gl.createBuffer()
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer)
      this.gl.bufferData(this.gl.ARRAY_BUFFER, attributeData.array, this.gl.STATIC_DRAW)
      this.attributeBuffers.set(name, buffer)
    }

    // 创建 indices buffer
    this.indicesBuffer = this.gl.createBuffer()
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indicesBuffer)
    this.gl.bufferData(
      this.gl.ELEMENT_ARRAY_BUFFER,
      // new Uint16Array(mesh.indices),
      this.mesh.indicesData,
      this.gl.STATIC_DRAW
    )

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null)
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null)
  }

  // 启动 vertex 的 vertices、normals、texture coordinates 属性
  // 绑定索引数据 indices
  bindGeometryInfo() {
    const gl = this.gl

    const type = this.gl.FLOAT
    const normalize = false
    const stride = 0
    const offset = 0

    for (const [name, buffer] of this.attributeBuffers) {
      const location = this.shader.program.attribs[name]
      // console.log(location)

      if (location >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.vertexAttribPointer(
          this.shader.program.attribs[name],
          this.mesh.attributes.get(name).size,
          type,
          normalize,
          stride,
          offset
        )
        gl.enableVertexAttribArray(location)
      }
    }

    gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indicesBuffer)
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

    // Bind material parameters
    this.updateMaterialParameters(updatedParamters)
    this.bindMaterialParameters(drawControlParams)

    // Draw
    {
      const vertexCount = this.mesh.count
      // const type = gl.UNSIGNED_SHORT // 启动了 OES_element_index_uint 扩展，别忘记把 indices 的类型改成 gl.UNSIGNED_INT
      const type = gl.UNSIGNED_INT
      const offset = 0
      // 使用线型渲染模式
      gl.drawElements(this.getWebGLDrawMode(), vertexCount, type, offset)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  // 专门为HUD设计的相机参数绑定
  bindHUDCameraParameters(camera: PerspectiveCamera, hudSize: number) {
    const gl = this.gl

    // 模型矩阵：保持单位矩阵，不进行任何变换
    const modelMatrix = mat4.create()
    mat4.identity(modelMatrix)

    // 视图矩阵：只提取相机的旋转部分，移除平移
    const viewMatrix = mat4.create()
    camera.updateMatrixWorld()

    // 从相机的世界矩阵中提取旋转
    const cameraMatrix = camera.matrixWorld.elements
    mat4.invert(viewMatrix, cameraMatrix)

    // 清除平移部分，只保留旋转
    viewMatrix[12] = 0 // x平移
    viewMatrix[13] = 0 // y平移
    viewMatrix[14] = 0 // z平移

    // 投影矩阵：使用正交投影，确保大小不变
    const projectionMatrix = mat4.create()
    const size = 0.1 // 坐标轴在HUD中的显示大小
    mat4.ortho(projectionMatrix, -size, size, -size, size, -size, size)

    // 传递矩阵到shader
    // this.shader.program.uniforms[k]
    gl.uniformMatrix4fv(this.shader.program.uniforms.uProjectionMatrix, false, projectionMatrix)
    gl.uniformMatrix4fv(this.shader.program.uniforms.uModelMatrix, false, modelMatrix)
    gl.uniformMatrix4fv(this.shader.program.uniforms.uViewMatrix, false, viewMatrix)

    // 相机位置对HUD不重要，设为原点
    gl.uniform3fv(this.shader.program.uniforms.uCameraPos, [0, 0, 0])
  }

  renderAsHUD(
    camera: PerspectiveCamera,
    drawControlParams: DrawControlParams,
    hudPosition: { x: number; y: number }, // 屏幕位置 (0-1范围)
    hudSize: number = 100 // HUD区域大小(像素)
  ) {
    const gl = this.gl

    // 保存当前视口
    const currentViewport = gl.getParameter(gl.VIEWPORT)

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    // 设置左下角HUD视口
    const screenX = hudPosition.x * currentViewport[2]
    const screenY = hudPosition.y * currentViewport[3]
    gl.viewport(screenX, screenY, hudSize, hudSize)

    // 禁用深度测试，确保坐标轴总在最前面
    gl.disable(gl.DEPTH_TEST)

    gl.useProgram(this.shader.program.glShaderProgram)

    // 绑定几何信息
    this.bindGeometryInfo()

    // 使用特殊的HUD相机参数
    this.bindHUDCameraParameters(camera, hudSize)

    // 绑定材质参数
    this.bindMaterialParameters(drawControlParams)

    // 绘制
    const vertexCount = this.mesh.count
    const type = gl.UNSIGNED_INT
    const offset = 0
    gl.drawElements(this.getWebGLDrawMode(), vertexCount, type, offset)

    // 恢复状态
    gl.enable(gl.DEPTH_TEST)
    gl.viewport(currentViewport[0], currentViewport[1], currentViewport[2], currentViewport[3])

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }
}
