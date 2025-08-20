export interface CubeMapConfig {
  basePath: string
  extension: string
  faceKeys?: string[]
}

export class CubeMapTexture {
  private gl: WebGLRenderingContext
  public texture: WebGLTexture | null
  constructor(gl: WebGLRenderingContext) {
    this.gl = gl
  }

  loadImageAsync(imageUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error(`Failed to load cubemap face: ${imageUrl}`))
      image.src = imageUrl
    })
  }

  async createCubeMapFromImages(cubeMapConfig: CubeMapConfig) {
    // 默认的面名称映射
    const defaultFaceKeys: string[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz']
    const faceKeys = cubeMapConfig.faceKeys || defaultFaceKeys

    // CubeMap面的WebGL常量顺序
    const faceTargets = [
      this.gl.TEXTURE_CUBE_MAP_POSITIVE_X, // px - 右
      this.gl.TEXTURE_CUBE_MAP_NEGATIVE_X, // nx - 左
      this.gl.TEXTURE_CUBE_MAP_POSITIVE_Y, // py - 上
      this.gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, // ny - 下
      this.gl.TEXTURE_CUBE_MAP_POSITIVE_Z, // pz - 前
      this.gl.TEXTURE_CUBE_MAP_NEGATIVE_Z // nz - 后
    ]

    this.texture = this.gl.createTexture()
    if (!this.texture) {
      throw new Error('Failed to create WebGL texture')
    }
    this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.texture)

    // Promise 数组
    const imagePromises = faceKeys.map((faceKey) => {
      const imageUrl = cubeMapConfig.basePath + faceKey + cubeMapConfig.extension

      return this.loadImageAsync(imageUrl)
    })

    try {
      const images = await Promise.all(imagePromises)

      images.forEach((image, index) => {
        this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.texture)
        this.gl.texImage2D(
          faceTargets[index],
          0,
          this.gl.RGBA,
          this.gl.RGBA,
          this.gl.UNSIGNED_BYTE,
          image
        )
      })

      this.setupTextureParameters()
      console.log(`✅ CubeMap loaded successfully from ${cubeMapConfig.basePath}`)
    } catch (error) {
      throw error
    }
  }

  // createCubeMapFromImages(cubeMapConfig: CubeMapConfig): Promise<void> {
  //   return new Promise((resolve, reject) => {
  //     // 默认的面名称映射
  //     const defaultFaceKeys: string[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz']
  //     const faceKeys = cubeMapConfig.faceKeys || defaultFaceKeys

  //     // CubeMap面的WebGL常量顺序
  //     const faceTargets = [
  //       this.gl.TEXTURE_CUBE_MAP_POSITIVE_X, // px - 右
  //       this.gl.TEXTURE_CUBE_MAP_NEGATIVE_X, // nx - 左
  //       this.gl.TEXTURE_CUBE_MAP_POSITIVE_Y, // py - 上
  //       this.gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, // ny - 下
  //       this.gl.TEXTURE_CUBE_MAP_POSITIVE_Z, // pz - 前
  //       this.gl.TEXTURE_CUBE_MAP_NEGATIVE_Z // nz - 后
  //     ]

  //     // 创建纹理
  //     let loadedTexCount = 0
  //     const totalTexCount = 6
  //     this.texture = this.gl.createTexture()
  //     if (!this.texture) {
  //       reject(new Error('Failed to create WebGL texture'))
  //       return
  //     }
  //     this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.texture)

  //     // 加载每个面
  //     faceKeys.forEach((faceKey, index) => {
  //       const image = new Image()
  //       const imageUrl = cubeMapConfig.basePath + faceKey + cubeMapConfig.extension

  //       image.onload = () => {
  //         // this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.texture)
  //         this.gl.texImage2D(
  //           faceTargets[index],
  //           0,
  //           this.gl.RGBA,
  //           this.gl.RGBA,
  //           this.gl.UNSIGNED_BYTE,
  //           image
  //         )

  //         loadedTexCount++
  //         if (loadedTexCount == totalTexCount) {
  //           this.setupTextureParameters()
  //           console.log(`✅ CubeMap loaded successfully from ${cubeMapConfig.basePath}`)
  //           resolve()
  //         }
  //       }

  //       image.onerror = () => {
  //         reject(new Error(`Failed to load cubemap face: ${imageUrl}`))
  //       }

  //       image.src = imageUrl
  //     })
  //   })
  // }

  setupTextureParameters() {
    this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.texture)
    // 设置纹理过滤
    this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)

    // 设置纹理包装模式
    this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
    // this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP, this.gl.TEXTURE_WRAP_R, this.gl.CLAMP_TO_EDGE)

    this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, null)
  }
}
