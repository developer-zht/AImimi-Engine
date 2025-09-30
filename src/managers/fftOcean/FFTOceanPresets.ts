import { setTransform } from '@/utils/transformation'
import { HDRBasedCubeMapTexture } from '@/textures/HDRBasedCubeMapTexture'
import { ImgBasedCubeMapTexture } from '@/textures/ImgBasedCubeMapTexture'
import { FileExtensions, TexturePaths } from '@/config/resourcePaths'
import { FFTOceanRenderManagerConfig } from '@/types/fftOcean'

export class FFTOceanPresets {
  private static instance: FFTOceanPresets
  private gl: WebGLRenderingContext

  private constructor(gl: WebGLRenderingContext) {
    this.gl = gl
  }

  public static getInstance(gl: WebGLRenderingContext) {
    if (!FFTOceanPresets.instance) {
      FFTOceanPresets.instance = new FFTOceanPresets(gl)
      return FFTOceanPresets.instance
    } else {
      return FFTOceanPresets.instance
    }
  }

  async createSkybox(): Promise<WebGLTexture> {
    // FIXME: skybox 和 ocean 实际上都是使用的是同一个 skybox texture，但又各自创建了一个 ImgBasedCubeMapTexture 实例，造成了内存浪费
    const skybox = new ImgBasedCubeMapTexture(this.gl)
    await skybox.createCubeMapFromImages({
      basePath: TexturePaths.SKY_SUNSET,
      extension: FileExtensions.PNG
    })
    const skyboxTexture = skybox.texture

    // const skyboxTexture = HDRBasedCubeMapTexture.getInstance(this.gl).envCubemap

    return skyboxTexture
  }

  async createFFTOceanParams(): Promise<FFTOceanRenderManagerConfig> {
    const skybox = await this.createSkybox()
    return {
      tranformation: setTransform(0, 0, 0, 1, 1, 1, 0, 0, 0),
      materialParams: {
        // 纹理使用标志
        useDiffuseMap: 0,
        useNormalMap: 0,
        useEnvironmentMap: 1,
        // 基础纹理
        diffuseMap: null,
        normalMap: null,
        environmentMap: skybox,
        // 水体颜色参数
        shallowWaterColor: [0.4, 0.9, 0.9],
        waterColor: [0.2, 0.6, 0.8],
        deepWaterColor: [0.0, 0.3, 0.6],
        // 水体物理参数
        transparency: 0.85,
        reflectance: 0.8,
        refractiveIndex: 1.33,
        // 波浪控制参数
        time: 0.0,
        // 水深模型参数
        depthModel: 2,
        maxDepth: 1000.0,
        minDepth: 1000.0,
        depthCenter: [0, 0],
        depthFalloff: 1.5,
        // 光照参数
        lightColor: [0.5, 0.5, 0.5],
        lightPos: [2, 2, 2],
        lightDir: [0.3, -0.7, 0.2],
        specularPower: 2.0,
        fresnelPower: 5.0,

        displacementMap: null,
        gradientMap: null,
        dispDerivativeMap: null
      },
      // oceanParams: {
      //   size: 1024, // size 米的海面
      //   resolution: 256, // resolution x resolution 网格
      //   windSpeed: 12, // windSpeed m/s风速
      //   windDirection: { x: 2, y: 1 }, // wind direction
      //   gravity: 9.81,
      //   choppiness: 2,
      //   fetch: 500000, // 风区长度 F, 单位米 (m)
      //   depth: 100,
      //   amplitude: 1000
      // }
      cascadeConfig: {
        enabled: false, // 是否启用 cascade，true 为 cascade，false 为 single
        targetResolution: 128, // 目标统一分辨率，默认使用最高层分辨率
        targetSize: 1024, // 目标统一范围，默认使用最大范围
        blendMode: 'weighted', // 混合模式：相加或加权
        layerParamsSet: [
          // ========== Layer 0: 长波主导层 ==========
          // 覆盖波长：50-500m，主要海浪形态
          {
            size: 1024, // 1km海面
            resolution: 256, // 高分辨率
            amplitude: 10, // 大幅降低，避免过度夸张
            choppiness: 0.8, // 温和的水平位移
            windSpeed: 10, // 中等风速
            windDirection: { x: 1, y: 1 },
            gravity: 9.81,
            fetch: 500000, // 50km fetch，更合理的中等海况
            depth: 1000
          },
          // ========== Layer 1: 中长波层 ==========
          // 覆盖波长：20-100m，增加海面复杂性
          {
            size: 512, // 512m海面
            resolution: 256, // 保持高分辨率
            amplitude: 100, // 中等振幅
            choppiness: 1.2, // 稍强的choppy效果
            windSpeed: 12, // 稍强风速
            windDirection: { x: 1, y: 1 },
            gravity: 9.81,
            fetch: 20000, // 20km fetch
            depth: 1000
          },
          // ========== Layer 2: 中波层 ==========
          // 覆盖波长：5-30m，海面中等细节
          // {
          //   size: 256, // 256m海面
          //   resolution: 256, // 高分辨率保证质量
          //   amplitude: 10, // 适中振幅
          //   choppiness: 2.2, // 更明显的尖锐波峰
          //   windSpeed: 15, // 强风速产生更多中波
          //   windDirection: { x: 1, y: 0.2 },
          //   gravity: 9.81,
          //   fetch: 8000, // 8km fetch
          //   depth: 1000
          // },
          // ========== Layer 3: 短波层 ==========
          // 覆盖波长：1-8m，重要的视觉细节
          // {
          //   size: 128, // 128m海面
          //   resolution: 256, // 维持高分辨率
          //   amplitude: 40, // 小振幅但重要
          //   choppiness: 2.5, // 强choppy效果
          //   windSpeed: 18, // 强风产生短波
          //   windDirection: { x: 1, y: 0 },
          //   gravity: 9.81,
          //   fetch: 3000, // 3km fetch
          //   depth: 100
          // },
          // ========== Layer 4: 毛细波层 ==========
          // 覆盖波长：0.2-2m，表面张力主导的小波浪
          {
            size: 64, // 64m海面，精细尺度
            resolution: 256, // 高分辨率捕捉毛细波
            amplitude: 10, // 小但可见的振幅
            choppiness: 3.0, // 最强choppy，模拟尖锐毛细波
            windSpeed: 20, // 强风产生毛细波
            windDirection: { x: 1, y: -1 },
            gravity: 9.81,
            fetch: 1000, // 短fetch，局部风浪
            depth: 100
          },
          {
            size: 32, // 64m海面，精细尺度
            resolution: 256, // 高分辨率捕捉毛细波
            amplitude: 10, // 小但可见的振幅
            choppiness: 3.0, // 最强choppy，模拟尖锐毛细波
            windSpeed: 22, // 强风产生毛细波
            windDirection: { x: 1, y: -1 },
            gravity: 9.81,
            fetch: 200, // 短fetch，局部风浪
            depth: 100
          }
        ]
      }
    }
  }
}
