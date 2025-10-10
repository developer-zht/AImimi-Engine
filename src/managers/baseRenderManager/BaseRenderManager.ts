import { Material } from '@/materials/Material'
import { Mesh } from '@/objects/Mesh'

export abstract class BaseRenderManager {
  protected gl: WebGLRenderingContext

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl
  }

  // 抽象方法 - 子类必须实现
  protected abstract createMesh(): Mesh
  protected abstract createMaterial(): Promise<Material>
}
