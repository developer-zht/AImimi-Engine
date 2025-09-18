import { ShaderPaths } from '@/config/resourcePaths'
import { AxisMaterial, buildAxisMaterial } from '@/materials/AxisMaterial'
import { AxisMesh } from '@/objects/AxisMesh'
import { MeshRender } from '@/renderers/MeshRender'
import { TransformationParams } from '@/types/transformation'
import { WebGLRenderer } from '@/renderers/WebGLRenderer'
import { LineRender } from '@/renderers/LineRender'
import { LineRenderMode } from '../../renderers/LineRender'

export interface AxisManagerParams {
  // 几何参数
  transformation: TransformationParams
}

class AxisManager {
  private gl: WebGLRenderingContext
  private config: AxisManagerParams

  private axisLineRender: LineRender

  constructor(gl: WebGLRenderingContext, config: AxisManagerParams) {
    this.gl = gl
    this.config = config
  }

  // 初始化 Axes Mesh
  private createAxesMesh(): AxisMesh {
    const mesh = new AxisMesh(this.config.transformation)

    return mesh
  }

  // 初始化 Axis Material
  private async createAxisMaterial(): Promise<AxisMaterial> {
    const material = await buildAxisMaterial(ShaderPaths.AXIS_VERTEX, ShaderPaths.AXIS_FRAGMENT)

    return material
  }

  // 初始化 AxisLineRender
  async initAxisLineRender() {
    try {
      const mesh = this.createAxesMesh()

      const material = await this.createAxisMaterial()

      const axisLineRender = new LineRender(this.gl, mesh, material, LineRenderMode.LINES, null)

      this.axisLineRender = axisLineRender

      console.log('Axis renderer initialize successfully.')
    } catch (error) {
      console.error('Failed to initialize axis renderer:', error)
      throw error
    }
  }

  getAxisLineRender() {
    return this.axisLineRender
  }
}

export async function loadAxis(renderer: WebGLRenderer, config: AxisManagerParams) {
  try {
    const axisManager = new AxisManager(renderer.gl, config)
    await axisManager.initAxisLineRender()
    // 将 MeshRender 添加到 WebGLRenderer 中
    // renderer.addLineRender(axisManager.getAxisLineRender())
    renderer.setAxisLineRender(axisManager.getAxisLineRender())
  } catch (error) {
    console.log('Load axes failed: ', error)
  }
}
