import { setTransform } from '@/utils/transformation'
import { HDRBasedCubeMapTexture } from '@/textures/HDRBasedCubeMapTexture'
import { ImgBasedCubeMapTexture } from '@/textures/ImgBasedCubeMapTexture'
import { FileExtensions, TexturePaths } from '@/config/resourcePaths'
import { BlendMode, FFTOceanRenderManagerConfig, RenderingMode } from '@/types/fftOcean'

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
        renderingMode: RenderingMode.LINE,
        // FIXME: 暂时未完成多波叠加
        enabled: false, // 是否启用 cascade，true 为 cascade，false 为 single
        meshResolution: 128, // 目标统一分辨率，默认使用最高层分辨率
        meshSize: 256, // 目标统一范围，默认使用最大范围
        blendMode: BlendMode.WEIGHT, // 混合模式：相加或加权
        layerParamsSet: [
          // 效果一
          {
            size: 256, // 256m 海面
            resolution: 128, // 128 分辨率
            amplitude: 30, // 振幅放大系数
            choppiness: 2.3, // 稍强的 choppy 效果
            windSpeed: 13, // 风速
            windDirection: { x: 1, y: 1 }, // 风向
            gravity: 9.81,
            fetch: 100000, // 100km fetch (单位: 米)
            depth: 1000 // 水深 (单位: 米)
          },
          // 效果二
          {
            size: 256, // 256m 海面
            resolution: 128, // 128 分辨率
            amplitude: 30, // 振幅放大系数
            choppiness: 3.3, // 稍强的 choppy 效果
            windSpeed: 13, // 风速
            windDirection: { x: 1, y: 1 }, // 风向
            gravity: 9.81,
            fetch: 100000, // 100km fetch (单位: 米)
            depth: 1000 // 水深 (单位: 米)
          },
          // 效果三
          {
            size: 256, // 256m 海面
            resolution: 128, // 128 分辨率
            amplitude: 30, // 振幅放大系数
            choppiness: 5.3, // 很强的 choppy 效果
            windSpeed: 13, // 风速
            windDirection: { x: 1, y: 1 }, // 风向
            gravity: 9.81,
            fetch: 100000, // 100km fetch (单位: 米)
            depth: 1000 // 水深 (单位: 米)
          },
          {
            size: 32, // 32m 海面
            resolution: 128, // 128 分辨率
            amplitude: 10, // 振幅放大系数
            choppiness: 3.0, // 稍强的 choppy 效果
            windSpeed: 22, // 风速
            windDirection: { x: 1, y: -1 },
            gravity: 9.81,
            fetch: 100000, // 100km fetch (单位: 米)
            depth: 1000 // 水深
          }
        ]
      }
    }
  }
}
