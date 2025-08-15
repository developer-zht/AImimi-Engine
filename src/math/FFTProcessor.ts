import { Complex } from '@/math/Complex'

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
  constructor() {}

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
    let result = value
    for (let i = 0; i < bitCount; i++) {
      // 如果 value 的第 i 位为 1，那么就将其与第  位进行翻转
      // 如果 value 的第 i 位为 0 则可不用进行翻转（节省运算次数）
      if (this.isBitSet(result, i)) {
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
    let angle = (sign * (2 * Math.PI * k)) / n
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
      let n = Math.pow(2, stage + 1)
      // 当前 downIndex - upIndex 的差值：2^stage
      let interval = Math.pow(2, stage)

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

      // 执行蝶形运算：f1(x) + Wnk * f2(x)
      output[i] = input[curButterfly.upIndex].add(
        curButterfly.wnk.multiply(input[curButterfly.downIndex])
      )
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
    const precomputedData = this.generatePrecomputeData(size, inverse)

    // 第一步：对输入数据进行位反转重排序
    const bitReversedValues: Complex[] = []
    for (let i = 0; i < size; i++) {
      // 计算位反转后的索引
      const reversedIndex = this.bitReverse(i, log2Size)
      // 按位反转顺序重新排列输入数据
      bitReversedValues[i] = input[reversedIndex]
    }

    // 初始化ping-pong缓冲区（双缓冲避免数据覆盖）
    let pingpong0: Complex[] = [...bitReversedValues]
    let pingpong1: Complex[] = new Array(size).fill(null).map(() => new Complex(0, 0))
    let pingpong = 0

    for (let stage = 0; stage < log2Size; stage++) {
      // 切换缓冲区
      pingpong = 1 - pingpong
      if (pingpong === 1) {
        this.calculateSingleButterfly(precomputedData, pingpong0, pingpong1, stage, size)
      } else {
        this.calculateSingleButterfly(precomputedData, pingpong1, pingpong0, stage, size)
      }
    }

    // 返回最终结果（根据最后使用的缓冲区）
    return pingpong === 0 ? pingpong0 : pingpong1
  }

  /**
   * 一维FFT的统一接口
   * @param input 输入数据（可以是数字数组或复数数组）
   * @param inverse 是否为逆变换
   * @returns FFT结果
   */
  public fft1DInterface(input: (number | Complex)[], inverse: boolean = false): Complex[] {
    // 将输入转换为复数数组
    const complexInput: Complex[] = input.map((x) =>
      x instanceof Complex ? x : Complex.fromReal(x)
    )

    // 执行FFT
    const result = this.calculateFFT1D(complexInput, inverse)

    // 如果是逆变换，需要除以N进行归一化
    if (inverse) {
      return result.map((x) => x.dividedBy(result.length))
    }

    return result
  }

  /**
   * 一维逆FFT (IFFT)
   * @param input 频域输入
   * @returns 时域输出
   */
  public ifft1DInterface(input: Complex[]): Complex[] {
    return this.fft1DInterface(input, true)
  }

  // =============== 以下：二维快速傅里叶变换 ===============

  public fft2DInterface(matrix: (number | Complex)[][], inverse: boolean = false): Complex[][] {
    const rows = matrix.length
    const cols = matrix[0].length

    // 验证输入
    if (rows !== cols) {
      throw new Error('2D FFT requires square matrix')
    }
    if ((rows & (rows - 1)) !== 0) {
      throw new Error('2D FFT matrix size must be a power of 2')
    }

    // 转换为复数矩阵
    let result: Complex[][] = matrix.map((row) =>
      row.map((x) => (x instanceof Complex ? x : Complex.fromReal(x)))
    )

    // 第一步：对每一行进行一维FFT（使用迭代版本）
    for (let i = 0; i < rows; i++) {
      result[i] = this.calculateFFT1D(result[i], inverse)
      // 如果是逆变换，对行进行归一化
      if (inverse) {
        result[i] = result[i].map((x) => x.dividedBy(cols))
      }
    }

    // 第二步：对每一列进行一维FFT（使用迭代版本）
    for (let j = 0; j < cols; j++) {
      // 提取第j列
      const column: Complex[] = []
      for (let i = 0; i < rows; i++) {
        column.push(result[i][j])
      }

      // 对列进行FFT
      const transformedColumn = this.calculateFFT1D(column, inverse)

      // 如果是逆变换，对列进行归一化
      const finalColumn = inverse
        ? transformedColumn.map((x) => x.dividedBy(rows))
        : transformedColumn

      // 将结果写回矩阵
      for (let i = 0; i < rows; i++) {
        result[i][j] = finalColumn[i]
      }
    }

    return result
  }

  // 二维逆FFT
  public ifft2DInterface(matrix: Complex[][]): Complex[][] {
    return this.fft2DInterface(matrix, true)
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
