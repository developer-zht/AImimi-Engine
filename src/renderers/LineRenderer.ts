import { Mesh } from '@/objects/Mesh'
import { BaseRenderer } from './BaseRenderer'
import { Material } from '@/materials/Material'
import { Shader } from '@/shaders/Shader'
import { assertNever } from '@/errors/helper/helpers'
import { LineRenderMode } from './types/LineRenderMode'

export class LineRenderer extends BaseRenderer {
  public renderMode: LineRenderMode

  constructor(
    gl: WebGLRenderingContext,
    mesh: Mesh,
    material: Material,
    shader: Shader,
    renderMode: LineRenderMode = LineRenderMode.LINES,
    label: string
  ) {
    super(gl, mesh, material, shader, LineRenderer.toGLMode(gl, renderMode), label)
    this.renderMode = renderMode
  }

  private static toGLMode(gl: WebGLRenderingContext, mode: LineRenderMode): GLenum {
    switch (mode) {
      case LineRenderMode.LINES:
        return gl.LINES
      case LineRenderMode.LINE_LOOP:
        return gl.LINE_LOOP
      case LineRenderMode.LINE_STRIP:
        return gl.LINE_STRIP

      default: {
        const _exhaustive: never = mode
        assertNever(_exhaustive)
        return _exhaustive
      }
    }
  }

  setRenderMode(mode: LineRenderMode): void {
    this.renderMode = mode
    this.drawMode = LineRenderer.toGLMode(this.gl, mode)
  }
}
