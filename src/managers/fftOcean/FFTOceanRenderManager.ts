import { WaterSurface } from '@/objects/WaterSurface'
import { TransformationParams } from '@/types/transformation'
import { OceanParams } from '@/managers/fftOcean/PhillipsSpectrum'
import { Mesh } from '@/objects/Mesh'
import {
  buildFFTOceanMaterial,
  FFTOceanMaterial,
  FFTOceanMaterialParams
} from '@/materials/FFTOceanMaterial'
import { MeshRender } from '@/renderers/MeshRender'
import { OceanTextureManager } from './OceanTextureManager'
import { FFTOceanGenerator } from './FFTOceanGenerator'
import { WebGLRenderer } from '@/renderers/WebGLRenderer'

export interface FFTOceanRenderManagerConfig {
  // 几何参数
  tranformation: TransformationParams

  // 材质参数
  materialParams: FFTOceanMaterialParams

  // FFT Ocean
  oceanParams: OceanParams
}

export class FFTOceanRenderManager {
  // 单例模式
  private static instance: FFTOceanRenderManager

  private gl: WebGLRenderingContext
  private config: FFTOceanRenderManagerConfig

  private fftOceanGenerator: FFTOceanGenerator
  private oceanTextureManager: OceanTextureManager

  private waterSurface: Mesh
  private fftOceanMaterial: FFTOceanMaterial
  private meshRender: MeshRender

  private constructor(gl: WebGLRenderingContext, config: FFTOceanRenderManagerConfig) {
    this.gl = gl
    this.config = config

    // 创建FFT生成器
    this.fftOceanGenerator = new FFTOceanGenerator(config.oceanParams)

    // 创建纹理管理器
    this.oceanTextureManager = new OceanTextureManager(gl, config.oceanParams.resolution)

    this.config.materialParams.displacementMap = this.oceanTextureManager.getDisplacementTexture()
    this.config.materialParams.normalMap = this.oceanTextureManager.getNormalTexture()
  }

  public static getInstance(gl: WebGLRenderingContext, config: FFTOceanRenderManagerConfig) {
    if (!FFTOceanRenderManager.instance) {
      FFTOceanRenderManager.instance = new FFTOceanRenderManager(gl, config)
      return FFTOceanRenderManager.instance
    } else {
      return FFTOceanRenderManager.instance
    }
  }

  // 创建网格
  private createWaterSurface(): Mesh {
    const waterSurface = new WaterSurface(
      this.config.tranformation,
      this.config.oceanParams.size,
      this.config.oceanParams.resolution
    )

    return waterSurface
  }

  // 创建材质
  private async createFFTOceanMaterial(): Promise<FFTOceanMaterial> {
    // Debug Code
    // console.log(this.config.materialParams)
    return await buildFFTOceanMaterial(
      this.config.materialParams,
      'src/shaders/fftOceanShader/FFTOceanVertex.glsl',
      'src/shaders/fftOceanShader/FFTOceanFragment.glsl'
    )
  }

  // 初始化 MeshRender
  async initMeshRender() {
    try {
      this.waterSurface = this.createWaterSurface()
      this.fftOceanMaterial = await this.createFFTOceanMaterial()
      this.meshRender = new MeshRender(
        this.gl,
        this.waterSurface,
        this.fftOceanMaterial,
        FFTOceanRenderManager.getInstance(this.gl, this.config)
      )
    } catch (error) {
      console.error('Failed to initialize water renderer:', error)
      throw error
    }
  }

  update(time: number) {
    // 更新FFT数据
    this.fftOceanGenerator.update(time)

    // console.log(this.meshRender)

    // 更新纹理
    this.oceanTextureManager.updateTextures(this.fftOceanGenerator)
  }

  // 获取当前的 MeshRender 对象
  getMeshRender(): MeshRender | null {
    return this.meshRender
  }
}

export async function loadFFTOcean(renderer: WebGLRenderer, config: FFTOceanRenderManagerConfig) {
  try {
    const fftOceanRenderManager = FFTOceanRenderManager.getInstance(renderer.gl, config)
    await fftOceanRenderManager.initMeshRender()
    // 将 MeshRender 添加到 WebGLRenderer 中
    renderer.addMeshRender(fftOceanRenderManager.getMeshRender())
  } catch (error) {
    console.log('Load water failed: ', error)
  }
}
