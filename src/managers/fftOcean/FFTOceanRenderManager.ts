import { WaterSurface } from '@/objects/WaterSurface'
import { Mesh } from '@/objects/Mesh'
import { buildFFTOceanMaterial, FFTOceanMaterial } from '@/materials/FFTOceanMaterial'
import { MeshRender } from '@/renderers/MeshRender'
import { OceanTextureManager } from './OceanTextureManager'
import { FFTOceanGenerator } from './FFTOceanGenerator'
import { WebGLRenderer } from '@/renderers/WebGLRenderer'
import { ShaderPaths } from '@/config/resourcePaths'
import { FFTOceanRenderManagerConfig } from '@/types/fftOcean'
import { FFTOceanTextureManager } from './FFTOceanTextureManager'
import { FFTProcessor } from '@/math/FFTProcessor/FFTProcessor'
import { FFTOceanSpectrumGenerator } from './FFTOceanSpectrumGenerator'

export class FFTOceanRenderManager {
  // 单例模式
  private static instance: FFTOceanRenderManager

  private gl: WebGLRenderingContext
  private config: FFTOceanRenderManagerConfig

  private fftOceanGenerator: FFTOceanGenerator
  private oceanTextureManager: OceanTextureManager

  private fftProcessor: FFTProcessor
  private fftOceanSpectrumGenerator: FFTOceanSpectrumGenerator
  private fftOceanTextureManager: FFTOceanTextureManager

  private waterSurface: Mesh
  private fftOceanMaterial: FFTOceanMaterial
  private meshRender: MeshRender

  private constructor(gl: WebGLRenderingContext, config: FFTOceanRenderManagerConfig) {
    this.gl = gl
    this.config = config

    // // 创建FFT生成器
    // this.fftOceanGenerator = new FFTOceanGenerator(this.gl, config.cascadeConfig)

    // // 创建纹理管理器
    // this.oceanTextureManager = new OceanTextureManager(gl, config.cascadeConfig.targetResolution)

    this.fftProcessor = new FFTProcessor(this.gl)
    this.fftOceanSpectrumGenerator = new FFTOceanSpectrumGenerator(config.cascadeConfig)
    const spectrumMaxResolution = Math.max(
      ...config.cascadeConfig.layerParamsSet.map((layer) => layer.resolution)
    )
    this.fftOceanTextureManager = new FFTOceanTextureManager(
      gl,
      this.fftProcessor,
      spectrumMaxResolution
    )

    this.config.materialParams.displacementMap =
      this.fftOceanTextureManager.getDisplacementTexture()
    this.config.materialParams.gradientMap = this.fftOceanTextureManager.getGradientTexture()
    this.config.materialParams.dispDerivativeMap = this.fftOceanTextureManager.getJacobianTexture()

    // this.config.materialParams.displacementMap = this.oceanTextureManager.getDisplacementTexture()
    // this.config.materialParams.gradientMap = this.oceanTextureManager.getGradientTexture()
    // this.config.materialParams.dispDerivativeMap =
    //   this.oceanTextureManager.getDisDerivativeTexture()
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
      this.config.cascadeConfig.meshSize,
      this.config.cascadeConfig.meshResolution
    )

    return waterSurface
  }

  // 创建材质
  private async createFFTOceanMaterial(): Promise<FFTOceanMaterial> {
    // Debug Code
    // console.log(this.config.materialParams)
    return await buildFFTOceanMaterial(
      this.config.materialParams,
      this.config.cascadeConfig,
      ShaderPaths.FFT_OCEAN_VERTEX,
      ShaderPaths.FFT_OCEAN_FRAGMENT
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

  async update(time: number) {
    // 更新FFT数据
    // await this.fftOceanGenerator.generateOcean(time)
    // console.log(this.meshRender)
    // 更新纹理
    // this.oceanTextureManager.updateTextures(this.fftOceanGenerator)
    const spectrums = this.fftOceanSpectrumGenerator.generateRealTimeOceanSpectrum(time)

    this.fftOceanTextureManager.updateTextures({
      height: spectrums.heightSpectrum,
      dispX: spectrums.dispXSpectrum,
      dispZ: spectrums.dispZSpectrum,
      slopeX: spectrums.slopeXSpectrum,
      slopeZ: spectrums.slopeZSpectrum,
      dDx_dx: spectrums.dDx_dxSpectrum,
      dDz_dz: spectrums.dDz_dzSpectrum,
      dDx_dz: spectrums.dDx_dzSpectrum,
      dDz_dx: spectrums.dDz_dxSpectrum
    })
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
