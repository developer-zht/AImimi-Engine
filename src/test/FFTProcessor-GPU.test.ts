import { describe, it, expect, beforeAll } from 'vitest'
import gl from 'gl'
import { Complex } from '@/math/Complex'
import { FFTProcessor } from '@/math/FFTProcessor/FFTProcessor'
import { FFTOceanTextureManager } from '@/managers/fftOcean/FFTOceanTextureManager'
import * as math from 'mathjs'

describe('FFT Ocean Texture Manager - GPU vs Mathjs on CPU', () => {
  // let gl: WebGLRenderingContext
  let glContext: WebGLRenderingContext
  // let canvas: HTMLCanvasElement
  let fftProcessor: FFTProcessor
  let textureManager: FFTOceanTextureManager

  const SIZE = 64 // 测试大小

  beforeAll(() => {
    // 以下方法无法创建真实的 WebGL 上下文
    // canvas = document.createElement('canvas')
    // canvas.width = SIZE
    // canvas.height = SIZE

    // gl = canvas.getContext('webgl', {
    //   preserveDrawingBuffer: true // ← 重要：允许 readPixels
    // })

    // if (!gl) {
    //   throw new Error('WebGL not supported')
    // }

    // fftProcessor = new FFTProcessor(gl)
    // textureManager = new FFTOceanTextureManager(gl, fftProcessor, SIZE)

    // ✅ 使用 headless-gl 创建 WebGL 上下文
    glContext = gl(SIZE, SIZE, {
      preserveDrawingBuffer: true
    }) as unknown as WebGLRenderingContext

    if (!glContext) {
      throw new Error('WebGL not supported')
    }

    fftProcessor = new FFTProcessor(glContext)
    textureManager = new FFTOceanTextureManager(glContext, fftProcessor, SIZE)
  })

  it('should match mathjs IFFT', () => {
    // 1. 创建测试数据（简单的峰值频谱）
    const testSpectrum = createTestSpectrum(SIZE)

    // 2. GPU IFFT
    const gpuResult = computeGPU_IFFT(testSpectrum)

    // 3. CPU IFFT (mathjs)
    const cpuResult = computeCPU_IFFT(testSpectrum)

    // 4. 比较结果
    const maxError = compareResults(gpuResult, cpuResult)

    console.log('最大误差:', maxError)
    expect(maxError).toBeLessThan(1e-3) // 允许浮点误差
  })

  /**
   * 创建测试频谱（中心峰值）
   */
  function createTestSpectrum(size: number): Complex[][] {
    const spectrum: Complex[][] = []

    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        // 在中心创建一个高斯峰
        const dx = i - size / 2
        const dy = j - size / 2
        const r = Math.sqrt(dx * dx + dy * dy)
        const amplitude = Math.exp((-r * r) / ((size * size) / 16))

        spectrum[i][j] = new Complex(amplitude, 0)
      }
    }

    return spectrum
  }

  /**
   * GPU IFFT 计算
   */
  function computeGPU_IFFT(spectrum: Complex[][]): number[][] {
    // 更新纹理管理器
    textureManager.updateTextures({
      height: spectrum,
      dispX: createEmptySpectrum(SIZE),
      dispZ: createEmptySpectrum(SIZE),
      slopeX: createEmptySpectrum(SIZE),
      slopeZ: createEmptySpectrum(SIZE),
      dDx_dx: createEmptySpectrum(SIZE),
      dDz_dz: createEmptySpectrum(SIZE),
      dDx_dz: createEmptySpectrum(SIZE),
      dDz_dx: createEmptySpectrum(SIZE)
    })

    // 读取位移纹理（height 在 G 通道）
    const dispTexture = textureManager.getDisplacementTexture()

    const spatialResult = readTextureData(dispTexture, SIZE, 1)

    return spatialResult
  }

  /**
   * CPU IFFT 计算 (mathjs)
   */
  function computeCPU_IFFT(spectrum: Complex[][]) {
    const mathjsMatrix: math.Complex[][] = spectrum.map((row) => {
      return row.map((c) => math.complex(c.real, c.imag))
    })

    // 2D IFFT
    const result = math.ifft(mathjsMatrix)

    const spatialResult = result.map((row) => row.map((c) => c.re))

    return spatialResult
  }

  /**
   * 比较两个结果
   */
  function compareResults(gpuResult: number[][], cpuResult: number[][]): number {
    let maxError = 0
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE; j++) {
        const error = gpuResult[i][j] - cpuResult[i][j]
        maxError = error > maxError ? error : maxError
      }
    }

    return maxError
  }

  /**
   * 读取纹理数据
   */
  function readTextureData(
    texture: WebGLTexture,
    size: number,
    channel: number // 0=R, 1=G, 2=B, 3=A
  ): number[][] {
    // 创建临时 FBO
    const fbo = glContext.createFramebuffer()
    glContext.bindFramebuffer(glContext.FRAMEBUFFER, fbo)
    glContext.framebufferTexture2D(
      glContext.FRAMEBUFFER,
      glContext.COLOR_ATTACHMENT0,
      glContext.TEXTURE_2D,
      texture,
      0
    )

    // 读取像素
    const pixels = new Float32Array(size * size * 4)
    glContext.readPixels(0, 0, size, size, glContext.RGBA, glContext.FLOAT, pixels)

    const result: number[][] = []
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const index = (i * size + j) * 4
        result[i][j] = pixels[index + channel]
      }
    }

    return result
  }

  function createEmptySpectrum(size: number): Complex[][] {
    return Array(size)
      .fill(null)
      .map(() =>
        Array(size)
          .fill(null)
          .map(() => new Complex(0, 0))
      )
  }
})
