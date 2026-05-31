import { Shader } from '@/shaders/Shader'

export function drawCube(gl: WebGLRenderingContext, vbo: WebGLBuffer, shader: Shader) {
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo)

  const loc = shader.getAttribLocation('aVertexPosition')
  if (loc === -1) {
    console.warn(
      '[drawCube] Attribute "aVertexPosition" not found in equirectToCubemap shader. ' +
        'CubeMap conversion will produce empty faces.'
    )
    return
  }

  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0)
  gl.drawArrays(gl.TRIANGLES, 0, 36)
  gl.disableVertexAttribArray(loc)
}
