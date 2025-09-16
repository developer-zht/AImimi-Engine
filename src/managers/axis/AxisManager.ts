import { ShaderPaths } from '@/config/resourcePaths'
import { AxisMaterial, buildAxisMaterial } from '@/materials/AxisMaterial'
import { AxisMesh } from '@/objects/AxisMesh'
import { MeshRender } from '@/renderers/MeshRender'
import { TransformationParams } from '@/types/transformation'
import { WebGLRenderer } from '@/renderers/WebGLRenderer'

export interface AxisManagerParams {
  // 几何参数
  transformation: TransformationParams
}

class AxisManager {
  private gl: WebGLRenderingContext
  private config: AxisManagerParams

  private meshRender: MeshRender

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

  // 初始化 MeshRender
  async initMeshRender() {
    try {
      const mesh = this.createAxesMesh()

      const material = await this.createAxisMaterial()

      const meshRender = new MeshRender(this.gl, mesh, material, null)

      this.meshRender = meshRender

      console.log('Axis renderer initialize successfully.')
    } catch (error) {
      console.error('Failed to initialize axis renderer:', error)
      throw error
    }
  }

  getMeshRender() {
    return this.meshRender
  }
}

export async function loadAxis(renderer: WebGLRenderer, config: AxisManagerParams) {
  try {
    const axisManager = new AxisManager(renderer.gl, config)
    await axisManager.initMeshRender()
    // 将 MeshRender 添加到 WebGLRenderer 中
    renderer.addMeshRender(axisManager.getMeshRender())
  } catch (error) {
    console.log('Load axes failed: ', error)
  }
}
