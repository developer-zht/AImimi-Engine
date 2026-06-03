import { mat4 } from 'gl-matrix'

export function getCaptureViewMatrices(): mat4[] {
  const viewMatrices = [
    mat4.lookAt(mat4.create(), [0, 0, 0], [1, 0, 0], [0, -1, 0]), // +X
    mat4.lookAt(mat4.create(), [0, 0, 0], [-1, 0, 0], [0, -1, 0]), // -X
    mat4.lookAt(mat4.create(), [0, 0, 0], [0, 1, 0], [0, 0, 1]), // +Y
    mat4.lookAt(mat4.create(), [0, 0, 0], [0, -1, 0], [0, 0, -1]), // -Y
    mat4.lookAt(mat4.create(), [0, 0, 0], [0, 0, 1], [0, -1, 0]), // +Z
    mat4.lookAt(mat4.create(), [0, 0, 0], [0, 0, -1], [0, -1, 0]) // -Z
  ]

  return viewMatrices
}
