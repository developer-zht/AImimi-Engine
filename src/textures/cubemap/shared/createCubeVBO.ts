import { MeshVBOCreationError } from '@/errors/EngineError/MeshError/MeshVBOCreationError'

export function createCubeVBO(gl: WebGLRenderingContext): WebGLBuffer {
  const vertices = new Float32Array([
    1, 1, 1, 1, -1, 1, 1, -1, -1, 1, -1, -1, 1, 1, -1, 1, 1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1, 1, 1, -1, 1, 1, 1, 1, 1, 1, -1, 1, 1, -1, 1, -1, -1, -1,
    -1, -1, -1, 1, 1, -1, 1, 1, -1, 1, 1, -1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, -1, 1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, -1, 1, -1, -1, -1, -1
  ])

  const vbo = gl.createBuffer()
  if (!vbo) {
    throw new MeshVBOCreationError(
      'vbo',
      'HDR to CubeMap conversion: failed to create cube VBO',
      'HDRToCubeMap_ToolCube'
    )
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

  return vbo
}
