import { BaseRenderManager } from './BaseRenderManager'
import { Mesh } from '@/objects/Mesh'
import { Material } from '@/materials/Material-deprecated'
import { LineRender } from '@/renderers/LineRender'

export abstract class BaseLineRenderManager extends BaseRenderManager {
  protected lineRender: LineRender | null

  constructor(gl: WebGLRenderingContext) {
    super(gl)
  }

  // 抽象方法 - 子类必须实现
  abstract initLineRender(): Promise<void>

  // 公共的具体方法 - 所有子类都可以使用
  getLineRender(): LineRender | null {
    return this.lineRender
  }

  // 可选方法 - 子类可以选择性覆盖
  destroy(): void {
    this.lineRender = null
  }
}
