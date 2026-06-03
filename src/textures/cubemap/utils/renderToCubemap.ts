import { mat4 } from 'gl-matrix'

import { RenderToCubemapConfig } from './types/renderToCubemap'
import { captureGLState, restoreGLState, setCleanBakeState } from '@/utils/gl/withCleanGLState'
import { createCubeVBO } from '../shared/createCubeVBO'
import { getCaptureViewMatrices } from '../shared/getCaptureViewMatrices'
import { drawCube } from '../shared/drawCube'

export function renderToCubemap(gl: WebGLRenderingContext, config: RenderToCubemapConfig): void {
  const cubeVBO = createCubeVBO(gl)

  const modelMatrix = mat4.create()
  const viewMatrices = getCaptureViewMatrices()
  const projectionMatrix = mat4.perspective(mat4.create(), Math.PI / 2, 1, 0.1, 10)

  // 保存 GL 状态
  // const savedFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer
  // const savedViewport = gl.getParameter(gl.VIEWPORT) as Int32Array
  // const vpX = savedViewport[0] ?? 0
  // const vpY = savedViewport[1] ?? 0
  // const vpW = savedViewport[2] ?? gl.canvas.width
  // const vpH = savedViewport[3] ?? gl.canvas.height

  const saved = captureGLState(gl)
  setCleanBakeState(gl)

  const shader = config.shader
  shader.use()
  shader.setMat4('uModelMatrix', modelMatrix)
  shader.setMat4('uProjectionMatrix', projectionMatrix)
  config.setupCommonUniforms?.(shader)

  for (let i = 0; i < 6; i++) {
    config.cubemapFBO.bindFace(i)
    if (config.clearDepth) gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT)

    shader.setMat4('uViewMatrix', viewMatrices[i]!)
    config.setupSpecificUniforms?.(shader, i)

    drawCube(gl, cubeVBO, shader)
  }

  // dispose vbo
  gl.deleteBuffer(cubeVBO)

  // 恢复 GL 状态
  // gl.bindFramebuffer(gl.FRAMEBUFFER, savedFramebuffer)
  // gl.viewport(vpX, vpY, vpW, vpH)
  restoreGLState(gl, saved)
}
