/**
 * N×N 复数矩阵的紧凑存储
 *
 * 用两个 Float32Array 分别存实部和虚部，替代 Complex[][]。
 *
 * 优势（对比 Complex[][]）：
 * 1. 类型安全：Float32Array[index] 返回 number，不是 number | undefined
 * 2. 零 GC：构造时分配一次，运行时无对象创建
 * 3. 缓存友好：连续内存布局
 * 4. 可直接上传 GPU：Float32Array 是 gl.texImage2D 的原生参数
 *
 * 内存布局：
 *   real[n * N + m] = 第 (n, m) 个元素的实部
 *   imag[n * N + m] = 第 (n, m) 个元素的虚部
 */
export class ComplexBuffer {
  readonly real: Float32Array
  readonly imag: Float32Array
  readonly N: number

  constructor(N: number) {
    this.N = N
    this.real = new Float32Array(N * N)
    this.imag = new Float32Array(N * N)
  }

  // ---- 逐元素访问 ----

  getReal(n: number, m: number): number {
    return this.real[n * this.N + m] ?? 0
  }

  getImag(n: number, m: number): number {
    return this.imag[n * this.N + m] ?? 0
  }

  setReal(n: number, m: number, value: number): void {
    this.real[n * this.N + m] = value
  }

  setImag(n: number, m: number, value: number): void {
    this.imag[n * this.N + m] = value
  }

  set(n: number, m: number, real: number, imag: number): void {
    const idx = n * this.N + m
    this.real[idx] = real
    this.imag[idx] = imag
  }

  // ---- 批量操作 ----

  /**
   * 打包成 GPU 纹理数据格式（RGBA Float32）
   * R = real, G = imag, B = 0, A = 0
   *
   * 可直接传给 gl.texImage2D(... gl.RGBA, gl.FLOAT, result)
   */
  toTextureData(): Float32Array {
    const size = this.N * this.N
    const data = new Float32Array(size * 4)
    for (let i = 0; i < size; i++) {
      data[i * 4] = this.real[i] ?? 0
      data[i * 4 + 1] = this.imag[i] ?? 0
    }
    return data
  }

  /** 清理数据 */
  clear(): void {
    this.real.fill(0)
    this.imag.fill(0)
  }
}
