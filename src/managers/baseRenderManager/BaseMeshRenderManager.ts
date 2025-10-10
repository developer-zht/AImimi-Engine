import { BaseRenderManager } from './BaseRenderManager'
import { Mesh } from '@/objects/Mesh'
import { Material } from '@/materials/Material'
import { MeshRender } from '@/renderers/MeshRender'

export abstract class BaseMeshRenderManager extends BaseRenderManager {
  protected meshRender: MeshRender | null

  constructor(gl: WebGLRenderingContext) {
    super(gl)
  }

  // 抽象方法 - 子类必须实现
  abstract initMeshRender(): Promise<void>
  abstract update(time: number): Promise<void>

  // 公共的具体方法 - 所有子类都可以使用
  getMeshRender(): MeshRender | null {
    return this.meshRender
  }

  // 可选方法 - 子类可以选择性覆盖
  destroy(): void {
    this.meshRender = null
  }
}
