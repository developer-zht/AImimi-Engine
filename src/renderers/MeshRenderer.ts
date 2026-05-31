import { Mesh } from '@/objects/Mesh'
import { Material } from '@/materials/Material'
import { Shader } from '@/shaders/Shader'
import { BaseRenderer } from './BaseRenderer'

/**
 * 纯类型标记子类：固定 drawMode = gl.TRIANGLES
 * 如果需要渲染前计算（FFT海洋），通过 addManager() 挂载
 */
export class MeshRenderer extends BaseRenderer {
  constructor(
    gl: WebGLRenderingContext,
    mesh: Mesh,
    material: Material,
    shader: Shader,
    name: string
  ) {
    super(gl, mesh, material, shader, gl.TRIANGLES, name)
  }
}
