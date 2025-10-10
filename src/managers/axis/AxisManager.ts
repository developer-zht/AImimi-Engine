import { ShaderPaths } from '@/config/resourcePaths'
import { AxisMaterial, buildAxisMaterial } from '@/materials/AxisMaterial'
import { AxisMesh } from '@/objects/AxisMesh'
import { TransformationParams } from '@/types/transformation'
import { WebGLRenderer } from '@/renderers/WebGLRenderer'
import { LineRender } from '@/renderers/LineRender'
import { LineRenderMode } from '../../renderers/LineRender'
import { BaseLineRenderManager } from '../baseRenderManager/BaseLineRenderManager'

export interface AxisManagerParams {
  // 几何参数
  transformation: TransformationParams
}

class AxisManager extends BaseLineRenderManager {
  private config: AxisManagerParams

  constructor(gl: WebGLRenderingContext, config: AxisManagerParams) {
    super(gl)
    this.config = config
  }

  // 初始化 Axes Mesh
  protected createMesh(): AxisMesh {
    const mesh = new AxisMesh(this.config.transformation)

    return mesh
  }

  // 初始化 Axis Material
  protected async createMaterial(): Promise<AxisMaterial> {
    const material = await buildAxisMaterial(ShaderPaths.AXIS_VERTEX, ShaderPaths.AXIS_FRAGMENT)

    return material
  }

  // 初始化 AxisLineRender
  async initLineRender() {
    try {
      const mesh = this.createMesh()

      const material = await this.createMaterial()

      const axisLineRender = new LineRender(this.gl, mesh, material, LineRenderMode.LINES, null)

      this.lineRender = axisLineRender

      console.log('Axis renderer initialize successfully.')
    } catch (error) {
      console.error('Failed to initialize axis renderer:', error)
      throw error
    }
  }

  getLineRender() {
    return this.lineRender
  }
}

export async function loadAxis(renderer: WebGLRenderer, config: AxisManagerParams) {
  try {
    const axisManager = new AxisManager(renderer.gl, config)
    await axisManager.initLineRender()
    // 将 LineRender 添加到 WebGLRenderer 中
    // renderer.addLineRender(axisManager.getAxisLineRender())
    renderer.setAxisLineRender(axisManager.getLineRender())
  } catch (error) {
    console.log('Load axes failed: ', error)
  }
}
