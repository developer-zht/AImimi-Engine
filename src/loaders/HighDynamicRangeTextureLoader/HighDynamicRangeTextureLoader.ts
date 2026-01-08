import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
import { DataTexture } from 'three'
import * as THREE from 'three'
import { HighDynamicRangeTextureType } from './types/HighDynamicRangeTextureLoader'
import { EngineRunningError } from '@/errors/EngineError/EngineRunningError'
import { ResourceLoadError } from '@/errors/ResourceError/ResourceLoadError'

/**
 * 加载用于 IBL 的高动态范围纹理
 * 支持格式：HDR/RGBE (.hdr), OpenEXR (.exr)
 */
export class HighDynamicRangeTextureLoader {
  // private gl: WebGLRenderingContext
  // private rgbeLoader: RGBELoader | null = null
  // private exrLoader: EXRLoader | null = null

  // constructor(gl: WebGLRenderingContext) {
  //   this.gl = gl
  // }

  constructor() {}

  // private async loadHDRFile(filePath: string): Promise<WebGLTexture> {
  //   console.log(`🔄 Loading HDR file: ${filePath}`)
  //   // 创建 RGBELoader
  //   this.rgbeLoader = new RGBELoader()
  //   // 设置 RGBELoader 的加载类型
  //   this.rgbeLoader.setDataType(THREE.FloatType)

  //   try {
  //     const dataTexture: DataTexture = await this.rgbeLoader.loadAsync(
  //       filePath,
  //       (e: ProgressEvent) => {
  //         let percent = (e.loaded / e.total) * 100
  //         if (percent % 10 < 1) {
  //           console.log(`HDR texture has loaded ${percent.toFixed(2)}%`)
  //         }
  //       }
  //     )
  //     const { data, width, height } = dataTexture.source.data
  //     // 判断被加载文件的通道类型
  //     const externalFormat = data / (width * height) === 3 ? this.gl.RGB : this.gl.RGBA
  //     // 内部格式与外部格式保持一致
  //     const internalFormat = externalFormat
  //     console.log(`🔘 DataTexture: ${dataTexture}`)
  //     const hdrTexture = this.gl.createTexture()
  //     if (!hdrTexture) {
  //       throw new Error('❌ 无法创建 WebGL 纹理对象')
  //     }
  //     this.gl.bindTexture(this.gl.TEXTURE_2D, hdrTexture)
  //     this.gl.texImage2D(
  //       this.gl.TEXTURE_2D,
  //       0,
  //       internalFormat,
  //       width,
  //       height,
  //       0,
  //       externalFormat,
  //       this.gl.FLOAT,
  //       data
  //     )
  //     // 设置 Texture 参数
  //     this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
  //     this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
  //     this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
  //     this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)

  //     this.gl.bindTexture(this.gl.TEXTURE_2D, null)
  //     console.log(`🔘 HDRTexture: ${hdrTexture}`)
  //     return hdrTexture
  //   } catch (error) {
  //     console.error('❌ .hdr 文件加载失败:', error)
  //     throw error
  //   }
  // }

  /**
   * 加载环境贴图
   * @param filePath 文件路径
   * @param {HighDynamicRangeTextureType} fileType 文件格式（自动检测如果未指定）
   */
  async load(filePath: string, fileType: HighDynamicRangeTextureType) {
    // Debug Code
    console.log(`🔄 Loading ${fileType}: ${filePath}`)
    try {
      switch (fileType) {
        case HighDynamicRangeTextureType.HDR: {
          return await this.loadRGBE(filePath)
        }
        case HighDynamicRangeTextureType.EXR: {
          return await this.loadEXR(filePath)
        }
        default: {
          throw new EngineRunningError(
            `Unsupported format: ${fileType}`,
            'UNSUPPORTED_HDR_FORMAT',
            {
              context: { fileType, filePath },
              recoverable: false
            }
          )
        }
      }
    } catch (error) {
      // 如果是 EngineRunningError，直接抛出
      if (error instanceof EngineRunningError) {
        throw error
      }

      // 否则包装成 ResourceLoadError
      throw new ResourceLoadError(
        fileType.toLowerCase(), // 'hdr' 或 'exr'
        filePath,
        undefined,
        error instanceof Error ? error : undefined
      )
    }
  }

  private async loadRGBE(path: string): Promise<DataTexture> {
    const loader = new RGBELoader()
    loader.setDataType(THREE.FloatType)

    return await loader.loadAsync(path)
  }

  private async loadEXR(path: string): Promise<DataTexture> {
    const loader = new EXRLoader()
    loader.setDataType(THREE.FloatType)

    return await loader.loadAsync(path)
  }

  // private async loadOriginFile(filePath: string, fileType: TextureFileType): Promise<DataTexture> {
  //   // Debug Code
  //   console.log(`🔄 Loading ${fileType}: ${filePath}`)
  //   if (fileType === TextureFileType.HDR) {
  //     // 创建 RGBELoader
  //     this.rgbeLoader = new RGBELoader()
  //     // 设置 RGBELoader 的加载类型
  //     this.rgbeLoader.setDataType(THREE.FloatType)
  //   } else if (fileType === TextureFileType.EXR) {
  //     // 创建 EXRLoader
  //     this.exrLoader = new EXRLoader()
  //     // 设置 EXRLoader 的加载类型
  //     this.exrLoader.setDataType(THREE.FloatType)
  //   }

  //   try {
  //     const dataTexture = await this.exrLoader.loadAsync(filePath, (e) => {
  //       const percent = (e.loaded / e.total) * 100
  //       if (percent % 10 < 1) {
  //         console.log(`EXR texture has loaded ${percent.toFixed(2)}%`)
  //       }
  //     })

  //     return dataTexture
  //   } catch (error) {
  //     console.error('❌ .exr 文件加载失败:', error)
  //     throw error
  //   }
  // }

  // public async loadHDRDataTexture(
  //   filePath: string,
  //   fileType: TextureFileType
  // ): Promise<DataTexture> {
  //   switch (fileType) {
  //     case TextureFileType.HDR:
  //       return await this.loadHDRFile(filePath, fileType)
  //     case TextureFileType.EXR:
  //       return await this.loadHDRFile(filePath, fileType)
  //     default:
  //       throw new Error(`There is no ${fileType} Texture!`)
  //   }
  // }
}
