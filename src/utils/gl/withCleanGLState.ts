// src/utils/gl/withCleanGLState.ts
export function captureGLState(gl: WebGLRenderingContext) {
  return {
    framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer,
    viewport: Array.from(gl.getParameter(gl.VIEWPORT) as Int32Array),
    cullFace: gl.getParameter(gl.CULL_FACE) as boolean,
    scissor: gl.getParameter(gl.SCISSOR_TEST) as boolean,
    blend: gl.getParameter(gl.BLEND) as boolean,
    depthTest: gl.getParameter(gl.DEPTH_TEST) as boolean,
    colorMask: gl.getParameter(gl.COLOR_WRITEMASK) as [boolean, boolean, boolean, boolean]
  }
}

export function setCleanBakeState(gl: WebGLRenderingContext) {
  gl.disable(gl.CULL_FACE)
  gl.disable(gl.SCISSOR_TEST)
  gl.disable(gl.BLEND)
  gl.disable(gl.DEPTH_TEST)
  gl.colorMask(true, true, true, true)
}

export function restoreGLState(gl: WebGLRenderingContext, s: ReturnType<typeof captureGLState>) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, s.framebuffer)
  gl.viewport(
    s.viewport[0] ?? 0,
    s.viewport[1] ?? 0,
    s.viewport[2] ?? gl.canvas.width,
    s.viewport[3] ?? gl.canvas.height
  )
  if (s.cullFace) gl.enable(gl.CULL_FACE)
  else gl.disable(gl.CULL_FACE)
  if (s.scissor) gl.enable(gl.SCISSOR_TEST)
  else gl.disable(gl.SCISSOR_TEST)
  if (s.blend) gl.enable(gl.BLEND)
  else gl.disable(gl.BLEND)
  if (s.depthTest) gl.enable(gl.DEPTH_TEST)
  else gl.disable(gl.DEPTH_TEST)
  gl.colorMask(
    s.colorMask[0] ?? true,
    s.colorMask[1] ?? true,
    s.colorMask[2] ?? true,
    s.colorMask[3] ?? true
  )
}
