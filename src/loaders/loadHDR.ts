import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
import { DataTexture } from 'three'
import * as THREE from 'three'

export enum TextureFileType {
  HDR = 'HDR_FILE',
  EXR = 'EXR_FILE'
}

export class HDRTextureLoader {
  private gl: WebGLRenderingContext
  private rgbeLoader: RGBELoader | null = null
  private exrLoader: EXRLoader | null = null

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl
  }

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

  private async loadHDRFile(filePath: string, fileType: TextureFileType): Promise<DataTexture> {
    // Debug Code
    console.log(`🔄 Loading ${fileType}: ${filePath}`)
    if (fileType === TextureFileType.HDR) {
      // 创建 RGBELoader
      this.rgbeLoader = new RGBELoader()
      // 设置 RGBELoader 的加载类型
      this.rgbeLoader.setDataType(THREE.FloatType)
    } else if (fileType === TextureFileType.EXR) {
      // 创建 EXRLoader
      this.exrLoader = new EXRLoader()
      // 设置 EXRLoader 的加载类型
      this.exrLoader.setDataType(THREE.FloatType)
    }

    try {
      const dataTexture = await this.exrLoader.loadAsync(filePath, (e) => {
        const percent = (e.loaded / e.total) * 100
        if (percent % 10 < 1) {
          console.log(`EXR texture has loaded ${percent.toFixed(2)}%`)
        }
      })

      return dataTexture
    } catch (error) {
      console.error('❌ .exr 文件加载失败:', error)
      throw error
    }
  }

  public async loadHDRTexture(filePath: string, fileType: TextureFileType): Promise<DataTexture> {
    switch (fileType) {
      case TextureFileType.HDR:
        return await this.loadHDRFile(filePath, fileType)
      case TextureFileType.EXR:
        return await this.loadHDRFile(filePath, fileType)
      default:
        throw new Error(`There is no ${fileType} Texture!`)
    }
  }
}
