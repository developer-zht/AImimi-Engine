import { ShaderPaths } from '@/config/resourcePaths'
import { getShaderString } from '@/loaders/loadShader'
import { Complex } from '@/math/Complex'
import { Shader } from '@/shaders/Shader'
import { FBO } from '@/textures/FBO'

/**
 * 蝶形元素结构 - 存储蝶形运算所需的信息
 */
class ButterflyElement {
  // 旋转因子Wnk，即复数单位根
  public wnk: Complex
  // 蝶形运算的上端点索引
  public upIndex: number
  // 蝶形运算的下端点索引
  public downIndex: number

  /**
   * 构造函数
   * @param wnk 旋转因子
   * @param upIndex 上端点索引
   * @param downIndex 下端点索引
   */
  constructor(wnk: Complex, upIndex: number, downIndex: number) {
    this.wnk = wnk
    this.upIndex = upIndex
    this.downIndex = downIndex
  }
}

/**
 * FFT处理器类 - 实现一维和二维FFT算法
 * 处理步骤：
 * 1.预计算旋转因子Wnk：其中 n = 2, 4, 8, ..., 2^logN
 * 2.对输入序列进行bit reverse 重排序
 * 3.按照蝶形网络的模式进行 f1(x) + Wnk * f2(x) 形式的加和
 */
export class FFTProcessor {
  // CPU 成员
  private precomputedData: {
    size: number
    inverse: boolean
    data: ButterflyElement[]
  }

  // GPU 成员
  private gl: WebGLRenderingContext | null = null
  private gpuEnabled: boolean = false

  private stockhamShader: Shader | null = null
  private stockham2DShader: Shader | null = null
  private pingFBO: FBO | null = null
  private pongFBO: FBO | null = null
  private fullscreenQuad: {
    vertexBuffer: WebGLBuffer
    indexBuffer: WebGLBuffer
  } | null = null
  // ✅ FFT 专用纹理单元
  private readonly FFT_TEXTURE_UNIT = 15 // 使用 TEXTURE15

  private count = 0
  private maxCount = 30

  constructor(gl?: WebGLRenderingContext) {
    this.precomputedData = {
      size: 0,
      inverse: false,
      data: []
    }

    if (gl) {
      this.gl = gl
      this.initGPUResources()
    }
  }

  // =============== GPU 端 ===============
  // 初始化
  private async initGPUResources() {
    if (!this.gl) return

    try {
      await this.loadFFTShaders()
      this.createFullscreenQuad()
      this.gpuEnabled = true
      console.log('✅ FFT GPU加速已启用 (Stockham算法)')
    } catch (error) {
      console.error('❌ FFT GPU初始化失败:', error)
      this.gpuEnabled = false
    }
  }

  private async loadFFTShaders() {
    if (!this.gl) return

    const vertexShaderContent = await getShaderString(ShaderPaths.FFT_STOCKHAM_VERTEX)
    const stockhamFragContent = await getShaderString(ShaderPaths.FFT_STOCKHAM_FRAGMENT)
    const stockham2DFragContent = await getShaderString(ShaderPaths.FFT_STOCKHAM_2D_FRAGMENT)

    // 一维 Stockham shader
    this.stockhamShader = new Shader(this.gl, vertexShaderContent, stockhamFragContent, {
      attribs: ['aVertexPosition', 'aTextureCoord'],
      uniforms: ['uInputTexture', 'uSubtransformSize', 'uTransformSize', 'uInverse']
    })

    // 二维 Stockham shader（支持水平/垂直）
    this.stockham2DShader = new Shader(this.gl, vertexShaderContent, stockham2DFragContent, {
      attribs: ['aVertexPosition', 'aTextureCoord'],
      uniforms: ['uInputTexture', 'uSubtransformSize', 'uTransformSize', 'uInverse', 'uDirection']
    })
  }

  private createFullscreenQuad() {
    if (!this.gl) return
    const gl = this.gl

    const vertices = new Float32Array([
      -1.0, -1.0, 0.0, 0.0, 0.0, 1.0, -1.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, -1.0, 1.0, 0.0,
      0.0, 1.0
    ])

    const indices = new Uint32Array([0, 1, 2, 0, 2, 3])

    this.fullscreenQuad = {
      vertexBuffer: gl.createBuffer()!,
      indexBuffer: gl.createBuffer()!
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.fullscreenQuad.vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.fullscreenQuad.indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)
  }

  /**
   * GPU 一维 FFT (Stockham 算法 - 无需 bit-reversal!)
   */
  private calculateFFT1D_GPU_Stockham(input: Complex[], inverse: boolean): Complex[] {
    if (!this.gl) return
    const size = input.length
    const log2Size = Math.log2(size)

    this.ensureFBOSize(size, 1) // 1D: width=size, height=1

    // 步骤1: 上传输入数据（输入已经是顺序的！）
    const inputTexture = this.uploadComplexDataToTexture(input, size, 1)

    // 步骤2: Stockham 迭代（不需要 bit-reversal pass！）
    // 每个 stage 的 subtransformSize: 2, 4, 8, 16, ..., N
    let currentPing = true // 初始数据在临时纹理，第一次写入 pingFBO

    for (let stage = 0; stage < log2Size; stage++) {
      const subtransformSize = Math.pow(2, stage + 1) // 2, 4, 8, ...

      // 确定读写 FBO
      let readTexture: WebGLTexture
      let writeFBO: FBO

      if (stage === 0) {
        // 第一个 stage 从输入纹理读取
        readTexture = inputTexture
        writeFBO = this.pingFBO!
      } else {
        // 后续 stage 在 ping-pong 之间切换
        const readFBO = currentPing ? this.pingFBO : this.pongFBO
        writeFBO = currentPing ? this.pongFBO : this.pingFBO
        readTexture = readFBO.getFrameBuffer().textures[0]
        currentPing = !currentPing
      }

      this.renderStockhamStage(readTexture, writeFBO, subtransformSize, size, inverse)
    }

    // 步骤3: 读回结果
    const finalFBO = log2Size % 2 === 1 ? this.pongFBO : this.pingFBO
    const result = this.readbackComplexData(finalFBO!, size, 1)

    // 清理
    this.gl!.deleteTexture(inputTexture)

    if (inverse) {
      return result.map((c) => c.dividedBy(size))
    }

    return result
  }

  /**
   * 渲染单个 Stockham stage
   */
  private renderStockhamStage(
    inputTexture: WebGLTexture,
    outputFBO: FBO,
    subtransformSize: number,
    transformSize: number,
    inverse: boolean
  ) {
    if (!this.gl || !this.stockhamShader) return
    const gl = this.gl

    // ❗ 1. 保存当前状态
    const savedFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING)
    const savedViewport = gl.getParameter(gl.VIEWPORT)
    const savedProgram = gl.getParameter(gl.CURRENT_PROGRAM)
    const savedTexture = gl.getParameter(gl.TEXTURE_BINDING_2D)

    // 2. 执行 FFT 渲染
    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFBO.getFrameBuffer())
    gl.viewport(0, 0, transformSize, 1)

    this.stockhamShader.use()
    this.stockhamShader.setTexture2D('uInputTexture', inputTexture, 0)
    this.stockhamShader.setInt('uSubtransformSize', subtransformSize)
    this.stockhamShader.setInt('uTransformSize', transformSize)
    this.stockhamShader.setInt('uInverse', inverse ? 1 : 0)

    this.drawFullscreenQuad(this.stockhamShader)

    // ❗ 3. 清理纹理绑定（在绘制完成后）
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, null)

    // ❗ 4. 恢复状态
    gl.bindFramebuffer(gl.FRAMEBUFFER, savedFramebuffer)
    gl.viewport(savedViewport[0], savedViewport[1], savedViewport[2], savedViewport[3])
    gl.useProgram(savedProgram)
    gl.bindTexture(gl.TEXTURE_2D, savedTexture)
  }

  /**
   * GPU 二维 FFT (Stockham)
   */
  private calculateFFT2D_GPU_Stockham(input: Complex[][], inverse: boolean): Complex[][] {
    if (!this.gl) return
    const gl = this.gl
    const size = input.length // 假设是方阵
    const log2Size = Math.log2(size)

    this.ensureFBOSize(size, size) // 2D: width=size, height=size

    // 上传 2D 数据
    const inputTexture = this.uploadComplexMatrix(input)

    let currentPing = true

    // 水平 FFT
    for (let stage = 0; stage < log2Size; stage++) {
      const subtransformSize = Math.pow(2, stage + 1)

      let readTexture: WebGLTexture
      let writeFBO: FBO

      if (stage === 0) {
        // 第一个 stage：从 inputTexture 读，写到 pingFBO
        readTexture = inputTexture
        writeFBO = this.pingFBO
        // currentPing = true (写入了 ping)
      } else {
        // ✅ 后续 stage：从上一次写入的 FBO 读
        const readFBO = currentPing ? this.pingFBO : this.pongFBO
        writeFBO = currentPing ? this.pongFBO : this.pingFBO // 写到另一个
        readTexture = readFBO.getFrameBuffer().textures[0]

        // ✅ 切换标志
        currentPing = !currentPing
      }

      this.renderStockhamStage2D(readTexture, writeFBO, subtransformSize, size, inverse, 0)
    }

    // 垂直 FFT
    for (let stage = 0; stage < log2Size; stage++) {
      const subtransformSize = Math.pow(2, stage + 1)

      const readFBO = currentPing ? this.pingFBO : this.pongFBO
      const writeFBO = currentPing ? this.pongFBO : this.pingFBO
      const readTexture = readFBO.getFrameBuffer().textures[0]

      this.renderStockhamStage2D(readTexture, writeFBO, subtransformSize, size, inverse, 1)
    }

    // 读回结果
    const finalFBO = currentPing ? this.pongFBO : this.pingFBO
    const flatResult = this.readbackComplexData(finalFBO, size, size)

    // 转换为矩阵
    const result: Complex[][] = []
    for (let i = 0; i < size; i++) {
      result[i] = flatResult.slice(i * size, (i + 1) * size)
    }

    this.gl.deleteTexture(inputTexture)

    return result
  }

  private renderStockhamStage2D(
    inputTexture: WebGLTexture,
    outputFBO: FBO,
    subtransformSize: number,
    transformSize: number,
    inverse: boolean,
    direction: number // 0=水平, 1=垂直
  ) {
    if (!this.gl || !this.stockham2DShader) return
    const gl = this.gl

    // ❗ 1. 保存当前状态
    const savedFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING)
    const savedViewport = gl.getParameter(gl.VIEWPORT)
    const savedProgram = gl.getParameter(gl.CURRENT_PROGRAM)
    const savedTexture = gl.getParameter(gl.TEXTURE_BINDING_2D)

    // 2. 执行 FFT 渲染
    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFBO.getFrameBuffer())
    gl.viewport(0, 0, transformSize, transformSize)

    // gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    this.stockham2DShader.use()
    this.stockham2DShader.setTexture2D('uInputTexture', inputTexture, 0)
    this.stockham2DShader.setInt('uSubtransformSize', subtransformSize)
    this.stockham2DShader.setInt('uTransformSize', transformSize)
    this.stockham2DShader.setInt('uInverse', inverse ? 1 : 0)
    this.stockham2DShader.setInt('uDirection', direction)

    if (__DEBUG__) {
      // ✅ 立即验证绑定是否成功
      gl.activeTexture(gl.TEXTURE0)
      const boundTexture = gl.getParameter(gl.TEXTURE_BINDING_2D)
      console.log('期望的纹理:', inputTexture)
      console.log('实际绑定的纹理:', boundTexture)
      console.log('绑定是否正确:', boundTexture === inputTexture)

      // 验证 uniform 值
      const uniformValue = gl.getUniform(
        this.stockham2DShader.program.glShaderProgram,
        this.stockham2DShader.getUniformLocation('uInputTexture')
      )
      console.log('uInputTexture uniform 值:', uniformValue) // 应该是 0
    }

    this.drawFullscreenQuad(this.stockham2DShader)

    // ❗ 3. 清理纹理绑定（在绘制完成后）
    gl.activeTexture(gl.TEXTURE0 + this.FFT_TEXTURE_UNIT)
    gl.bindTexture(gl.TEXTURE_2D, null)

    // ❗ 4. 恢复状态
    gl.bindFramebuffer(gl.FRAMEBUFFER, savedFramebuffer)
    gl.viewport(savedViewport[0], savedViewport[1], savedViewport[2], savedViewport[3])
    gl.useProgram(savedProgram)
    gl.bindTexture(gl.TEXTURE_2D, savedTexture)
  }

  // =============== GPU 端 Helper ===============
  private ensureFBOSize(width: number, height: number) {
    if (!this.gl) return
    const gl = this.gl

    if (!this.pingFBO || this.pingFBO.getWidth() !== width || this.pingFBO.getHeight() !== height) {
      this.pingFBO?.dispose()
      this.pongFBO?.dispose()

      // 注意: 这里需要修改 FBO 类支持自定义 attachment 数量
      // 对于 FFT 只需要 1 个颜色附件
      this.pingFBO = new FBO(gl, width, height, 1)
      this.pongFBO = new FBO(gl, width, height, 1)
    }
  }

  private uploadComplexDataToTexture(data: Complex[], width: number, height: number): WebGLTexture {
    if (!this.gl) return
    const gl = this.gl
    const size = width * height

    const pixels = new Float32Array(size * 4)
    for (let i = 0; i < size; i++) {
      pixels[i * 4 + 0] = data[i].real
      pixels[i * 4 + 1] = data[i].imag
      pixels[i * 4 + 2] = 0
      pixels[i * 4 + 3] = 1
    }

    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, pixels)

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    return texture
  }

  private uploadComplexMatrix(matrix: Complex[][]): WebGLTexture {
    const size = matrix.length
    const flat: Complex[] = []

    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        flat.push(matrix[i][j])
      }
    }

    return this.uploadComplexDataToTexture(flat, size, size)
  }

  private readbackComplexData(fbo: FBO, width: number, height: number): Complex[] {
    if (!this.gl) return
    const gl = this.gl

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.getFrameBuffer())

    const size = width * height
    const pixels = new Float32Array(size * 4)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, pixels)

    const result: Complex[] = []
    for (let i = 0; i < size; i++) {
      result.push(new Complex(pixels[i * 4], pixels[i * 4 + 1]))
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return result
  }

  private drawFullscreenQuad(shader: Shader) {
    if (!this.gl || !this.fullscreenQuad) return
    const gl = this.gl

    // ❗ 1. 保存当前的 buffer 绑定
    const savedArrayBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING)
    const savedElementArrayBuffer = gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING)

    const posLoc = shader.getAtrributeLocation('aVertexPosition')
    const uvLoc = shader.getAtrributeLocation('aTextureCoord')
    // 保存 vertex attribute 状态
    const savedPosEnabled = gl.getVertexAttrib(posLoc, gl.VERTEX_ATTRIB_ARRAY_ENABLED)
    const savedUvEnabled = gl.getVertexAttrib(uvLoc, gl.VERTEX_ATTRIB_ARRAY_ENABLED)

    // 2. 绘制 fullscreen quad
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fullscreenQuad.vertexBuffer)
    const stride = 5 * 4
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, stride, 0)
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, stride, 3 * 4)

    gl.enableVertexAttribArray(posLoc)
    gl.enableVertexAttribArray(uvLoc)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.fullscreenQuad.indexBuffer)
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0)

    // ❗ 3. 恢复原来的 buffer 绑定
    gl.bindBuffer(gl.ARRAY_BUFFER, savedArrayBuffer)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, savedElementArrayBuffer)

    // ❗ 4. 恢复 vertex attribute 状态
    if (!savedPosEnabled) {
      gl.disableVertexAttribArray(posLoc)
    }
    if (!savedUvEnabled) {
      gl.disableVertexAttribArray(uvLoc)
    }

    /**
     * FIXME
     * Buffer 绑定 (ARRAY_BUFFER_BINDING) ✅ 已恢复
     * Vertex Attribute Pointer (vertexAttribPointer 的配置) ❌ 未没恢复
     * Attribute 启用状态 (enableVertexAttribArray) ❌ 未恢复
     * 解决方案：https://claude.ai/chat/0d1b2963-3598-4c0f-8020-f843d51e9acc
     * 关键词：”方案 1：使用 VAO (Vertex Array Object) - 推荐但需要扩展“
     */
  }

  // =============== CPU 端 ===============
  /**
   * 检查 value 的第 bitIndex 位是否为 1（value 的最低位为第 0 位）
   * @param value 要检查的数值
   * @param bitIndex 位索引（从右开始计数，0-based）
   * @returns 如果指定位为 1 返回 true，否则返回 false
   */
  private isBitSet(value: number, bitIndex: number): boolean {
    return (value & (1 << bitIndex)) > 0
  }

  /**
   * 将 value 的第 bitIndex 位设置为 1（value 的最低位为第 0 位）
   * @param value 原始数值
   * @param bitIndex 要设置的位索引
   * @returns 设置后的新数值
   */
  private setBit(value: number, bitIndex: number): number {
    return value | (1 << bitIndex)
  }

  /**
   * 位反转算法 - FFT的关键预处理步骤
   * 将一个数的二进制表示进行位反转
   * 例如：3(011) -> 6(110)，用于FFT的输入重排序
   * @param value 要反转的数值
   * @param bitCount 使用的位数
   * @returns 位反转后的数值
   */
  private bitReverse(value: number, bitCount: number): number {
    // 如果 value 为 0，则无需翻转，直接返回
    if (value === 0) return 0
    let result = 0
    for (let i = 0; i < bitCount; i++) {
      // 如果 value 的第 i 位为 1，那么就将其与第 bitCount - 1 - i 位进行翻转
      // 如果 value 的第 i 位为 0 则可不用进行翻转（节省运算次数）
      if (this.isBitSet(value, i)) {
        // bitCount - 1 为最高位索引，减 i 表示从最高索引开始的偏移
        result = this.setBit(result, bitCount - 1 - i)
      }
    }
    return result
  }

  /**
   * 计算旋转因子Wnk
   * Wnk = e^(-2πi*k/n) = cos(-2π*k/n) + i*sin(-2π*k/n)
   * 这是DFT中的单位根，用于蝶形运算
   * @param n 当前蝶形网络的大小
   * @param k 频率索引
   * @returns 旋转因子复数
   */
  private calculateWnk(n: number, k: number, inverse: boolean = false): Complex {
    // 计算角度：-2π*k/n（负号表示顺时针旋转），逆变换时改变旋转方向
    const sign = inverse ? 1 : -1
    const angle = (sign * (2 * Math.PI * k)) / n
    // 返回指数形式的复数
    return Complex.createFromAngle(angle)
  }

  /**
   * 生成蝶形变换预计算数据
   * 对于 N 点 FFT，预先计算所有 stage 所需的蝶形元素
   * 包括旋转因子和对应的索引对
   * @param size FFT 的大小（必须是 2 的幂）
   * @returns 预计算的蝶形元素数组
   */
  private generatePrecomputeData(size: number, inverse: boolean = false): ButterflyElement[] {
    // 计算stage数量：log2(size)
    const log2Size = Math.log2(size)
    const precomputedData: ButterflyElement[] = []

    for (let stage = 0; stage < log2Size; stage++) {
      // 旋转因子 Wnk：其中 n = 2, 4, 8, ..., 2^log2N(log2Size)
      // 当前 stage 的蝶形网络大小：2^(stage+1)
      const n = Math.pow(2, stage + 1)
      // 当前 downIndex - upIndex 的差值：2^stage
      const interval = Math.pow(2, stage)

      // 为当前stage的每个位置生成蝶形元素
      for (let i = 0; i < size; i++) {
        const k = i % n
        let element: ButterflyElement

        // 根据位置决定蝶形运算的配对方式
        if (i % n < interval) {
          // 前半部分：当前位置作为上端点
          element = new ButterflyElement(
            this.calculateWnk(n, k, inverse), // 计算旋转因子
            i, // 上端点索引
            i + interval // 下端点索引（相距interval）
          )
        } else {
          // 后半部分：当前位置作为下端点
          element = new ButterflyElement(
            this.calculateWnk(n, k, inverse), // 计算旋转因子
            i - interval, // 上端点索引
            i // 下端点索引
          )
        }

        precomputedData.push(element)
      }
    }

    return precomputedData
  }

  /**
   * 蝶形变换内部实现
   * 执行单个stage的所有蝶形运算，即执行所有 n 和 k 一致的 wnk 的计算
   * 蝶形运算公式：output = input[up] + wnk * input[down]
   * @param precomputedData 预计算的蝶形元素
   * @param input 输入数组
   * @param output 输出数组
   * @param stage 当前stage索引
   * @param size FFT大小
   */
  private calculateSingleButterfly(
    precomputedData: ButterflyElement[],
    input: Complex[],
    output: Complex[],
    stage: number,
    size: number
  ) {
    // 遍历每个输出位置
    for (let i = 0; i < size; i++) {
      // 获取当前位置对应的蝶形元素
      const curButterfly = precomputedData[stage * size + i]

      const up = input[curButterfly.upIndex]
      const down = input[curButterfly.downIndex]
      const twiddle = curButterfly.wnk.multiply(down)

      // Debug Code
      // if (i == 0 || i == 1) {
      //   console.log(curButterfly.upIndex, curButterfly.downIndex)
      // }

      // output[curButterfly.upIndex] = up.add(twiddle)
      // output[curButterfly.downIndex] = up.subtract(twiddle)
      output[i] = up.add(twiddle)
    }
  }

  /**
   * 基于蝶形网络的一维FFT实现
   * 使用迭代方式，避免递归的开销
   * @param input 输入的复数数组
   * @returns FFT结果
   */
  public calculateFFT1D(input: Complex[], inverse: boolean = false): Complex[] {
    const size = input.length
    const log2Size = Math.log2(size)

    if ((size & (size - 1)) !== 0) {
      throw new Error('FFT size must be a power of 2')
    }

    // 生成预计算数据（所有stage的蝶形元素）
    if (this.precomputedData.size !== size || this.precomputedData.inverse !== inverse) {
      const data = this.generatePrecomputeData(size, inverse)
      this.precomputedData = {
        size: size,
        inverse: inverse,
        data: data
      }
    }

    // 第一步：对输入数据进行位反转重排序
    const bitReversedValues: Complex[] = []
    for (let i = 0; i < size; i++) {
      // 计算位反转后的索引
      const reversedIndex = this.bitReverse(i, log2Size)
      // 按位反转顺序重新排列输入数据
      bitReversedValues[i] = input[reversedIndex]
    }

    // Debug Code
    // console.log(bitReversedValues)

    // 初始化ping-pong缓冲区（双缓冲避免数据覆盖）
    const pingpong0: Complex[] = [...bitReversedValues]
    const pingpong1: Complex[] = new Array(size).fill(null).map(() => new Complex(0, 0))
    let pingpong = 0

    for (let stage = 0; stage < log2Size; stage++) {
      // 切换缓冲区
      pingpong = 1 - pingpong
      if (pingpong === 1) {
        this.calculateSingleButterfly(this.precomputedData.data, pingpong0, pingpong1, stage, size)
      } else {
        this.calculateSingleButterfly(this.precomputedData.data, pingpong1, pingpong0, stage, size)
      }
    }

    // 返回最终结果（根据最后使用的缓冲区）
    return pingpong === 0 ? pingpong0 : pingpong1
  }

  /**
   * 一维逆FFT (IFFT)
   * @param input 频域输入
   * @returns 时域输出
   */
  public ifft1DInterface(input: Complex[]): Complex[] {
    const out = this.fft1DInterface(input, true)
    return out
  }

  // =============== 以下：二维快速傅里叶变换 ===============
  // 二维逆FFT
  public ifft2DInterface(matrix: Complex[][]): Complex[][] {
    // const N = matrix.length
    const out = this.fft2DInterface(matrix, true)
    // const scale = 1 / (N * N)
    // return out.map((row) => row.map((x) => x.multiply(new Complex(scale, 0))))
    // if (this.count < this.maxCount) {
    //   console.log(out)
    //   this.count++
    // }

    return out
  }

  // =============== 公共接口 ===============
  /**
   * 一维FFT的统一接口
   * @param input 输入数据（可以是数字数组或复数数组）
   * @param inverse 是否为逆变换
   * @returns FFT结果
   */
  public fft1DInterface(input: (number | Complex)[], inverse: boolean = false): Complex[] {
    const complexInput: Complex[] = input.map((x) =>
      x instanceof Complex ? x : Complex.fromReal(x)
    )

    if (this.gpuEnabled && complexInput.length >= 64) {
      return this.calculateFFT1D_GPU_Stockham(complexInput, inverse)
    }

    // CPU fallback
    const result = this.calculateFFT1D(complexInput, inverse)
    if (inverse) {
      return result.map((x) => x.dividedBy(result.length))
    }
    return result
  }

  public fft2DInterface(matrix: (number | Complex)[][], inverse: boolean = false): Complex[][] {
    const rows = matrix.length
    const cols = matrix[0].length

    if (rows !== cols || (rows & (rows - 1)) !== 0) {
      throw new Error('2D FFT requires square matrix with power-of-2 size')
    }

    // 转换为复数矩阵
    const result: Complex[][] = matrix.map((row) =>
      row.map((x) => (x instanceof Complex ? x : Complex.fromReal(x)))
    )

    if (this.gpuEnabled && rows >= 32) {
      return this.calculateFFT2D_GPU_Stockham(result, inverse)
    }

    // CPU fallback
    // 第一步：对每一行进行一维FFT（使用迭代版本）
    // for (let i = 0; i < rows; i++) {
    //   result[i] = this.calculateFFT1D(result[i], inverse)
    //   // 如果是逆变换，对行进行归一化
    //   // if (inverse) {
    //   //   result[i] = result[i].map((x) => x.dividedBy(cols))
    //   // }
    // }

    // 第一步：对每一行进行FFT
    for (let i = 0; i < rows; i++) {
      result[i] = this.fft1DInterface(result[i], inverse)
    }

    // 第二步：对每一列进行FFT
    for (let j = 0; j < cols; j++) {
      const column: Complex[] = []
      for (let i = 0; i < rows; i++) {
        column.push(result[i][j])
      }

      const transformedColumn = this.fft1DInterface(column, inverse)

      for (let i = 0; i < rows; i++) {
        result[i][j] = transformedColumn[i]
      }
    }

    // 第二步：对每一列进行一维FFT（使用迭代版本）
    // for (let j = 0; j < cols; j++) {
    //   // 提取第j列
    //   const column: Complex[] = []
    //   for (let i = 0; i < rows; i++) {
    //     column.push(result[i][j])
    //   }

    //   // 对列进行FFT
    //   // const transformedColumn = this.calculateFFT1D(column, inverse)

    //   // // 如果是逆变换，对列进行归一化
    //   // const finalColumn = inverse
    //   //   ? transformedColumn.map((x) => x.dividedBy(rows))
    //   //   : transformedColumn

    //   // // 将结果写回矩阵
    //   // for (let i = 0; i < rows; i++) {
    //   //   result[i][j] = finalColumn[i]
    //   // }

    //   const transformedColumn = this.calculateFFT1D(column, inverse) // 同样不缩放

    //   for (let i = 0; i < rows; i++) result[i][j] = transformedColumn[i]
    // }

    return result
  }

  public enableGPU(enable: boolean) {
    this.gpuEnabled = enable && this.gl !== null
  }

  public dispose() {
    this.pingFBO?.dispose()
    this.pongFBO?.dispose()

    if (this.fullscreenQuad && this.gl) {
      this.gl.deleteBuffer(this.fullscreenQuad.vertexBuffer)
      this.gl.deleteBuffer(this.fullscreenQuad.indexBuffer)
    }
  }

  /**
   * 多项式乘法（基于FFT的快速卷积）
   * @param a 第一个多项式的系数
   * @param b 第二个多项式的系数
   * @returns 乘积多项式的系数
   */
  public polynomialMultiply(a: number[], b: number[]): number[] {
    // 结果多项式的长度
    const n = a.length + b.length - 1
    // 找到大于等于n的最小2的幂
    let size = 1
    while (size < n) size <<= 1

    // 转换为复数并补零到合适长度
    const fa: Complex[] = [...a.map((x) => Complex.fromReal(x))]
    const fb: Complex[] = [...b.map((x) => Complex.fromReal(x))]
    while (fa.length < size) fa.push(new Complex(0, 0))
    while (fb.length < size) fb.push(new Complex(0, 0))

    // 执行FFT变换到频域
    const fftA = this.fft1DInterface(fa)
    const fftB = this.fft1DInterface(fb)

    // 频域点乘（对应时域卷积）
    const product = fftA.map((x, i) => x.multiply(fftB[i]))

    // 执行逆FFT变换回时域
    const result = this.ifft1DInterface(product)

    // 提取实部并截取到正确长度
    return result.slice(0, n).map((x) => x.real)
  }

  /**
   * 信号卷积（时域卷积 = 频域相乘）
   * @param signal1 第一个信号
   * @param signal2 第二个信号
   * @returns 卷积结果
   */
  public convolution(signal1: number[], signal2: number[]): number[] {
    return this.polynomialMultiply(signal1, signal2)
  }

  /**
   * 计算信号的频谱（幅度谱）
   * @param signal 输入信号
   * @returns 频谱幅度数组
   */
  public getSpectrum(signal: number[]): number[] {
    const fftResult = this.fft1DInterface(signal)
    return fftResult.map((c) => c.magnitude())
  }

  /**
   * 计算二维信号的频谱
   * @param matrix 二维输入信号
   * @returns 二维频谱幅度矩阵
   */
  public getSpectrum2D(matrix: number[][]): number[][] {
    const fftResult = this.fft2DInterface(matrix)
    return fftResult.map((row) => row.map((c) => c.magnitude()))
  }
}
