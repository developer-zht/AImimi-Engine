import {
  buildGerstnerWaveMaterial,
  GerstnerWaveMaterialParams
} from '@/materials/GerstnerWaveMaterial'
import { buildSineWaveMaterial, SineWaveMaterialParams } from '@/materials/SineWaveMaterial'
import { WaterMaterial } from '@/materials/WaterMaterial'
import { WaterSurface } from '@/objects/WaterSurface'
import { MeshRender } from '@/renderers/MeshRender'
import { WebGLRenderer } from '@/renderers/WebGLRenderer'
import { ShaderPaths } from '@/config/resourcePaths'
import { WaterRenderManagerConfig, WaterRenderType } from '@/types/WaterRender'
import { BaseMeshRenderManager } from '@/managers/baseRenderManager/BaseMeshRenderManager'

/**
 * 水体渲染管理器（加载器）
 */
export class WaterRenderManager extends BaseMeshRenderManager {
  // private gl: WebGLRenderingContext
  private config: WaterRenderManagerConfig
  private waterSurface: WaterSurface | null = null
  private waterMaterial: WaterMaterial | null = null
  // private meshRender: MeshRender | null = null
  private renderType: WaterRenderManagerConfig['renderType']

  constructor(gl: WebGLRenderingContext, config: WaterRenderManagerConfig) {
    super(gl)
    // this.gl = gl
    this.config = config
    this.renderType = this.config.renderType
  }

  // 初始化 Water Surface
  protected createMesh(): WaterSurface {
    const waterSurface = new WaterSurface(
      this.config.tranformation,
      this.config.size,
      this.config.resolution
    )
    return waterSurface
  }

  // 创建 Water Material
  protected async createMaterial(): Promise<WaterMaterial> {
    switch (this.renderType) {
      case WaterRenderType.SINE_WAVE:
        return await buildSineWaveMaterial(
          this.config.materialParams as SineWaveMaterialParams, // 作用：覆盖默认值
          ShaderPaths.SINE_WAVE_VERTEX,
          ShaderPaths.SINE_WAVE_FRAGMENT
        )
      case WaterRenderType.GERSTNER_WAVE:
        return await buildGerstnerWaveMaterial(
          this.config.materialParams as GerstnerWaveMaterialParams, // 作用：覆盖默认值
          ShaderPaths.GERSTNER_WAVE_VERTEX,
          ShaderPaths.GERSTNER_WAVE_FRAGMENT
        )
      default:
        throw new Error(`Unknown water render type: ${this.config.renderType}`)
    }
  }

  // 初始化 MeshRender
  async initMeshRender() {
    try {
      this.waterSurface = this.createMesh()
      this.waterMaterial = await this.createMaterial()
      this.meshRender = new MeshRender(this.gl, this.waterSurface, this.waterMaterial)

      console.log(`Water renderer initialized with type: ${this.config.renderType}`)
    } catch (error) {
      console.error('Failed to initialize water renderer:', error)
      throw error
    }
  }

  update(time: number): Promise<void> {
    return
  }

  // 获取当前的MeshRender对象
  getMeshRender(): MeshRender | null {
    return this.meshRender
  }
}

export async function loadWater(
  renderer: WebGLRenderer,
  configPromise: Promise<WaterRenderManagerConfig>
) {
  try {
    const config = await configPromise
    const waterRenderManager = new WaterRenderManager(renderer.gl, config)
    await waterRenderManager.initMeshRender()

    // 将 MeshRender 添加到 WebGLRenderer 中
    renderer.addMeshRender(waterRenderManager.getMeshRender())
  } catch (error) {
    console.log('Load water failed: ', error)
  }
}
