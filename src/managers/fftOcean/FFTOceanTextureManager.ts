import { Complex } from '@/math/Complex'
import { FFTProcessor } from '@/math/FFTProcessor/FFTProcessor'
import { FBO } from '@/textures/FBO'

import * as math from 'mathjs'

interface TexturesData {
  name: string
  textures: WebGLTexture[]
}

interface SpectrumsData {
  name: string
  spectrumArray: Complex[][][]
}

export class FFTOceanTextureManager {
  private gl: WebGLRenderingContext
  private fftProcessor: FFTProcessor

  // Texture 尺寸
  private size: number

  // ✅ 三个输出 FBO（对应位移、梯度、Jacobian）
  private dispTextureFBO: FBO | null = null // [height, dispX, dispZ, unused]
  private gradientTextureFBO: FBO | null = null // [slopeX, slopeZ, unused, unused]
  private jacobianTextureFBO: FBO | null = null // [dDx_dx, dDz_dz, dDx_dz, dDz_dx]

  // ✅ Ping-Pong FBO（4 个附件，用于并行 FFT）
  private pingFBO: FBO | null = null
  private pongFBO: FBO | null = null

  constructor(gl: WebGLRenderingContext, fftProcessor: FFTProcessor, size: number) {
    this.gl = gl
    this.fftProcessor = fftProcessor
    this.size = size

    this.initFBOs()
  }

  private initFBOs() {
    const gl = this.gl

    // ✅ 创建三个输出 FBO（每个 4 个颜色附件）
    this.dispTextureFBO = new FBO(gl, this.size, this.size, 4)
    this.gradientTextureFBO = new FBO(gl, this.size, this.size, 4)
    this.jacobianTextureFBO = new FBO(gl, this.size, this.size, 4)

    // ✅ Ping-Pong FBO（4 个附件）
    this.pingFBO = new FBO(this.gl, this.size, this.size, 4)
    this.pongFBO = new FBO(this.gl, this.size, this.size, 4)
  }

  /**
   * 更新所有频谱并计算 FFT
   */
  public updateTextures(spectrums: {
    height: Complex[][]
    dispX: Complex[][]
    dispZ: Complex[][]
    slopeX: Complex[][]
    slopeZ: Complex[][]
    dDx_dx: Complex[][]
    dDz_dz: Complex[][]
    dDx_dz: Complex[][]
    dDz_dx: Complex[][]
  }) {
    // // 1. 检测 spectrum 大小
    // const detectedSize = spectrums.height.length

    // // 2. 验证所有 spectrum 大小一致
    // const sizes = [
    //   spectrums.height.length,
    //   spectrums.dispX.length,
    //   spectrums.dispZ.length,
    //   spectrums.slopeX.length,
    //   spectrums.slopeZ.length,
    //   spectrums.dDx_dx.length,
    //   spectrums.dDz_dz.length,
    //   spectrums.dDx_dz.length,
    //   spectrums.dDz_dx.length
    // ]

    // const allSame = sizes.every((size) => size === detectedSize)
    // if (!allSame) {
    //   throw new Error(`Spectrum 大小不一致: ${sizes.join(', ')}`)
    // }

    // // 3. 检查是否是 2 的幂
    // if ((detectedSize & (detectedSize - 1)) !== 0) {
    //   throw new Error(`Spectrum 大小必须是 2 的幂，当前: ${detectedSize}`)
    // }

    // // 4. 如果大小改变，重新初始化 FBO
    // if (this.size !== detectedSize) {
    //   console.log(`FFT 分辨率变化: ${this.size} → ${detectedSize}`)
    //   this.disposeFBOs()
    //   this.size = detectedSize
    //   this.initFBOs()
    // }

    // Debug Code
    const N = spectrums.height.length
    // testSpectrum[0][0] = new Complex(N * N, 0) // 只有 DC
    // 生成一个低频正弦波
    // testSpectrum[0][0] = new Complex(0, 0)
    // testSpectrum[1][0] = new Complex((N * N) / 2, 0) // 频率 k_x = 1
    // testSpectrum[N - 1][0] = new Complex((N * N) / 2, 0) // 共轭对称
    // 生成一个简单的低频波
    const testSpectrum: Complex[][] = Array(N)
      .fill(null)
      .map(() =>
        Array(N)
          .fill(null)
          .map(() => new Complex(0, 0))
      )

    // 只添加几个低频分量
    const amplitude = N * N * 0.5
    // testSpectrum[0][0] = new Complex(amplitude, 0) // DC = 0
    // testSpectrum[0][0] = new Complex(0, 0) // DC = 0
    // testSpectrum[1][0] = new Complex(amplitude, 0)
    // testSpectrum[N - 1][0] = new Complex(amplitude, 0)
    // testSpectrum[0][1] = new Complex(amplitude, 0)
    // testSpectrum[0][N - 1] = new Complex(amplitude, 0)

    const freq = 3 // 频率（控制条纹数量）

    // 只在一个方向设置
    testSpectrum[freq][freq] = new Complex(amplitude, -1)
    testSpectrum[N - freq][N - freq] = new Complex(amplitude, 1)

    // testSpectrum = this.generateFewWavesSpectrum(128)
    // testSpectrum = this.generateSimpleSineWave(128)
    // testSpectrum = this.generateSineWaveH0(128)
    // testSpectrum = this.computeHktFromH0(testSpectrum, 0, 1000)

    // const dispSpectrumArray = [spectrums.dispX, testSpectrum, spectrums.dispZ]
    const dispSpectrumArray = [spectrums.dispX, spectrums.height, spectrums.dispZ]
    const dispSpectrumData: SpectrumsData = {
      name: 'dispSpectrum',
      spectrumArray: dispSpectrumArray
    }
    this.computePass(dispSpectrumData, this.dispTextureFBO)

    const gradSpectrumArray = [spectrums.slopeX, spectrums.slopeZ]
    const gradSpectrumData: SpectrumsData = {
      name: 'gradSpectrum',
      spectrumArray: gradSpectrumArray
    }
    this.computePass(gradSpectrumData, this.gradientTextureFBO)

    const jacobSpectrumArray = [
      spectrums.dDx_dx,
      spectrums.dDz_dz,
      spectrums.dDx_dz,
      spectrums.dDz_dx
    ]
    const jacobSpectrumData: SpectrumsData = {
      name: 'jacobSpectrum',
      spectrumArray: jacobSpectrumArray
    }
    this.computePass(jacobSpectrumData, this.jacobianTextureFBO)
  }

  /**
   * 单个 Pass 计算
   */
  private computePass(spectrums: SpectrumsData, outputFBO: FBO) {
    // ✅ 1. 上传所有 spectrum 为独立纹理
    const texturesData: TexturesData = this.uploadMultiChannelSpectrums(spectrums)

    // ✅ 2. 执行 IFFT（水平 + 垂直），并将结果到输出 FBO
    const resultFBO = this.executeIFFT(texturesData, outputFBO)

    // ✅ 3. 清理临时纹理
    texturesData.textures.forEach((tex) => this.gl.deleteTexture(tex))
  }

  /**
   * 上传多个频谱到单个纹理的多个通道
   * 每个频谱的实部和虚部分别存储在 R/G、B/A、... 通道
   *
   * @param spectrums 1-4 个频谱（每个是 Complex[][]）
   * @returns 打包后的纹理
   */
  private uploadMultiChannelSpectrums(spectrums: {
    name: string
    spectrumArray: Complex[][][]
  }): TexturesData {
    const gl = this.gl
    const size = this.size
    const numSpectrums = spectrums.spectrumArray.length

    if (numSpectrums < 1 || numSpectrums > 4) {
      throw new Error('支持 1-4 个频谱')
    }

    const texturesData: {
      name: string
      textures: WebGLTexture[]
    } = {
      name: spectrums.name,
      textures: []
    }

    for (let num = 0; num < numSpectrums; num++) {
      texturesData.textures.push(
        this.fftProcessor.uploadComplexMatrix(spectrums.spectrumArray[num])
      )
    }

    return texturesData
  }

  /**
   * 执行 IFFT（水平 + 垂直）
   */
  private executeIFFT(texturesData: TexturesData, finalOutputFBO: FBO): FBO {
    const gl = this.gl
    const size = this.size
    const log2Size = Math.log2(size)
    const numChannels = texturesData.textures.length

    const inverse = true

    let currentPing = true

    // 水平 FFT
    for (let stage = 0; stage < log2Size; stage++) {
      const subtransformSize = Math.pow(2, stage + 1)

      let inputTextures: WebGLTexture[]
      let writeFBO: FBO

      if (stage === 0) {
        // 第一个 stage：从 inputTexture 读，写到 pingFBO
        inputTextures = texturesData.textures
        writeFBO = this.pingFBO
        // currentPing = true (写入了 ping)
      } else {
        // ✅ 后续 stage：从上一次写入的 FBO 读
        const readFBO = currentPing ? this.pingFBO : this.pongFBO
        writeFBO = currentPing ? this.pongFBO : this.pingFBO // 写到另一个
        inputTextures = readFBO.getFrameBuffer().textures.slice(0, numChannels)

        // ✅ 切换标志
        currentPing = !currentPing
      }

      this.fftProcessor.renderStockhamStage2D_MultiTexture(
        inputTextures,
        writeFBO,
        subtransformSize,
        size,
        inverse,
        0, // 水平
        false
      )
    }

    // 垂直 FFT
    for (let stage = 0; stage < log2Size; stage++) {
      const subtransformSize = Math.pow(2, stage + 1)

      const readFBO = currentPing ? this.pingFBO : this.pongFBO
      // 最后一个 stage 直接写入 finalOutputFBO
      const isLastStage = stage === log2Size - 1
      const writeFBO = isLastStage ? finalOutputFBO : currentPing ? this.pongFBO : this.pingFBO
      // const writeFBO = currentPing ? this.pongFBO : this.pingFBO
      const inputTextures = readFBO.getFrameBuffer().textures.slice(0, numChannels)

      this.fftProcessor.renderStockhamStage2D_MultiTexture(
        inputTextures,
        writeFBO,
        subtransformSize,
        size,
        inverse,
        1, // 垂直
        isLastStage
      )
      currentPing = !currentPing
    }

    // 读回结果
    // const finalFBO = currentPing ? this.pongFBO : this.pingFBO

    // return 没有实际作用，但是暂时保留
    return finalOutputFBO
  }

  // getter
  // 多个纹理
  public getDisplacementTexture(): WebGLTexture {
    // return [
    //   this.dispTextureFBO.getFrameBuffer().textures[1], // dispX
    //   this.dispTextureFBO.getFrameBuffer().textures[0], // height
    //   this.dispTextureFBO.getFrameBuffer().textures[2] // dispZ
    // ]
    const dispTexture = this.dispTextureFBO.getFrameBuffer().textures[0]

    this.gl.bindTexture(this.gl.TEXTURE_2D, dispTexture)

    // 过滤设置
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR_MIPMAP_LINEAR
    )
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)

    // 包裹模式（世界坐标采样需要 REPEAT）
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT)

    // 生成 mipmap
    this.gl.generateMipmap(this.gl.TEXTURE_2D)

    this.gl.bindTexture(this.gl.TEXTURE_2D, null)

    return dispTexture
  }

  public getGradientTexture(): WebGLTexture {
    // return [
    //   this.gradientTextureFBO.getFrameBuffer().textures[0], // slopeX
    //   this.gradientTextureFBO.getFrameBuffer().textures[1] // slopeZ
    // ]
    const gradTexture = this.gradientTextureFBO.getFrameBuffer().textures[0]

    this.gl.bindTexture(this.gl.TEXTURE_2D, gradTexture)

    // 过滤设置
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR_MIPMAP_LINEAR
    )
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)

    // 包裹模式
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT)

    // 生成 mipmap
    this.gl.generateMipmap(this.gl.TEXTURE_2D)

    this.gl.bindTexture(this.gl.TEXTURE_2D, null)

    return gradTexture
  }

  public getJacobianTexture(): WebGLTexture {
    // return [
    //   this.jacobianTextureFBO.getFrameBuffer().textures[0], // dDx_dx
    //   this.jacobianTextureFBO.getFrameBuffer().textures[1], // dDz_dz
    //   this.jacobianTextureFBO.getFrameBuffer().textures[2], // dDx_dz
    //   this.jacobianTextureFBO.getFrameBuffer().textures[3] // dDz_dx
    // ]
    const jacobTexture = this.jacobianTextureFBO.getFrameBuffer().textures[0]

    this.gl.bindTexture(this.gl.TEXTURE_2D, jacobTexture)

    // 过滤设置
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR_MIPMAP_LINEAR
    )
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)

    // 包裹模式
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT)

    // 生成 mipmap
    this.gl.generateMipmap(this.gl.TEXTURE_2D)

    this.gl.bindTexture(this.gl.TEXTURE_2D, null)

    return jacobTexture
  }
}
