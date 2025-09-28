import { FFTOceanGenerator } from '@/managers/fftOcean/FFTOceanGenerator'
import { CascadeConfig } from '@/types/fftOcean'

export class OceanTextureManager {
  private gl: WebGLRenderingContext
  private displacementTexture: WebGLTexture
  private gradientTexture: WebGLTexture
  private dispDerivativeTexture: WebGLTexture

  constructor(gl: WebGLRenderingContext, size: number) {
    this.gl = gl
    // displacementTexture 存位移 + 高度 + Jacobian
    this.displacementTexture = this.createFloatTexture(size)
    // gradientTexture 存法线梯度
    this.gradientTexture = this.createFloatTexture(size)
    // dispDerivativeTexture 存储
    this.dispDerivativeTexture = this.createFloatTexture(size)
  }

  private createFloatTexture(size: number): WebGLTexture {
    const texture = this.gl.createTexture()
    if (!texture) {
      throw new Error('Failed to create WebGL texture')
    }
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
    const emptyData = new Float32Array(size * size * 4).fill(0.0)
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      size,
      size,
      0,
      this.gl.RGBA,
      this.gl.FLOAT,
      emptyData
    )

    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)

    // Debug Code
    // console.log(texture)

    return texture
  }

  /**
   * 从 FFT 生成器获取空间域数据 → 打包成 GPU 可用的浮点纹理
   */
  updateTextures(generator: FFTOceanGenerator): void {
    const N = generator.getResolution()
    const size = N * N

    // 打包位移数据
    const displacementData = new Float32Array(size * 4)
    const heightField = generator.getHeightField()
    const dispX = generator.getDisplacementX()
    const dispZ = generator.getDisplacementZ()

    // 打包梯度（法线）数据
    const gradientData = new Float32Array(size * 4)
    const normalX = generator.getNormalX()
    const normalZ = generator.getNormalZ()

    // 打包求导数据
    const dispDerivativeData = new Float32Array(size * 4)
    const dDx_dx = generator.getDx_dx()
    const dDz_dz = generator.getDz_dz()
    const dDx_dz = generator.getDx_dz()
    const dDz_dx = generator.getDz_dx()

    // Debug Code
    // 检查 FFT 法线数据是否正常
    if (__DEBUG__) {
      const normalVariation = Math.abs(Math.max(...normalX) - Math.min(...normalX))
      console.log('Normal X variation:', normalVariation)
      if (normalVariation < 0.001) {
        console.error('❌ FFT 生成的法线数据没有变化！')
      } else {
        console.log('✅ FFT 法线数据正常')
      }
    }

    for (let i = 0; i < size; i++) {
      // 位移纹理：RGBA = (dispX, height, dispZ, jacobian)
      displacementData[i * 4 + 0] = dispX[i]
      displacementData[i * 4 + 1] = heightField[i]
      displacementData[i * 4 + 2] = dispZ[i]
      displacementData[i * 4 + 3] = this.calculateJacobian(
        // i,
        // N,
        dDx_dx[i],
        dDz_dz[i],
        dDx_dz[i],
        dDz_dx[i]
        // generator.getCascadeConfig()
      ) // 计算雅可比值（用于泡沫）

      // 梯度（法线）纹理：RGBA = (gradX, gradZ, 1.0, 1.0)
      gradientData[i * 4] = normalX[i]
      gradientData[i * 4 + 1] = normalZ[i]
      gradientData[i * 4 + 2] = 1.0
      gradientData[i * 4 + 3] = 1.0

      // 位移导数纹理：RGBA = (dDx_dx, dDz_dz, dDx_dz, dDz_dx)
      dispDerivativeData[i * 4] = dDx_dx[i]
      dispDerivativeData[i * 4 + 1] = dDz_dz[i]
      dispDerivativeData[i * 4 + 2] = dDx_dz[i]
      dispDerivativeData[i * 4 + 3] = dDz_dx[i]
    }

    // 调试输出
    // console.log('Displacement sample:', displacementData.slice(0, 4))
    // console.log('Normal sample:', normalData.slice(0, 4))

    // 更新纹理
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.displacementTexture)
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      N,
      N,
      0,
      this.gl.RGBA,
      this.gl.FLOAT,
      displacementData
    )

    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.gradientTexture)
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      N,
      N,
      0,
      this.gl.RGBA,
      this.gl.FLOAT,
      gradientData
    )

    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.dispDerivativeTexture)
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      N,
      N,
      0,
      this.gl.RGBA,
      this.gl.FLOAT,
      dispDerivativeData
    )

    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)

    // 解绑纹理
    this.gl.bindTexture(this.gl.TEXTURE_2D, null)
  }

  /**
   * 计算 Jacobian 行列式：
   * J = (1 + λ * ∂D_x/∂x)(1 + λ * ∂D_z/∂z) - λ² * (∂D_x/∂z)(∂D_z/∂x)
   * 用于描述海面网格在波浪影响下的局部面积变化
   * λ = choppiness 控制水平位移比例
   */
  calculateJacobian(
    // index: number,
    // N: number,
    dDx_dx: number,
    dDz_dz: number,
    dDx_dz: number,
    dDz_dx: number
    // cascadeConfig: CascadeConfig
  ): number {
    // 将 index 转换成二维坐标 (i,j)
    // const i = Math.floor(index / N)
    // const j = index % N

    // const dx = cascadeConfig.targetSize / N
    // const dz = cascadeConfig.targetSize / N

    // 边界处理
    // if (i === 0 || i === N - 1 || j === 0 || j === N - 1) return 1.0

    // 相邻索引
    // const indexRight = i * N + j + 1
    // const indexLeft = i * N + j - 1
    // const indexUp = (i - 1) * N + j
    // const indexDown = (i + 1) * N + j

    // 有限差分求偏导
    // const dDx_dx = (dispX[indexRight] - dispX[indexLeft]) / (2 * dx)
    // // console.log(dDx_dx)
    // const dDx_dz = (dispX[indexDown] - dispX[indexUp]) / (2 * dz)
    // // console.log(dDx_dz)
    // const dDz_dx = (dispZ[indexRight] - dispZ[indexLeft]) / (2 * dx)
    // // console.log(dDz_dx)
    // const dDz_dz = (dispZ[indexDown] - dispZ[indexUp]) / (2 * dz)
    // // console.log(dDz_dz)

    // const dDx_dx = (dispX[indexRight] - dispX[index]) / dx
    // const dDx_dz = (dispX[indexDown] - dispX[index]) / dz
    // const dDz_dx = (dispZ[index] - dispZ[indexLeft]) / dx
    // const dDz_dz = (dispZ[index] - dispZ[indexUp]) / dz

    // 在频谱里 已经乘了 λ → dispX, dispZ 已经是带 choppiness 的位移
    // const lambda = cascadeConfig.layerParamsSet[0].choppiness
    // const J = (1 + lambda * dDx_dx) * (1 + lambda * dDz_dz) - lambda * lambda * dDx_dz * dDz_dx
    const J = (1 + dDx_dx) * (1 + dDz_dz) - dDx_dz * dDz_dx

    return J
  }

  // getter
  getDisplacementTexture(): WebGLTexture {
    return this.displacementTexture
  }
  getGradientTexture(): WebGLTexture {
    return this.gradientTexture
  }
  getDisDerivativeTexture(): WebGLTexture {
    return this.dispDerivativeTexture
  }
}
