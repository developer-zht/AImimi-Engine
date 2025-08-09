export class Complex {
  /**
   * 利用欧拉公式创建指数形式的复数 e^(i*theta) = cos(theta) + i*sin(theta)
   * @param angle 角度（弧度）
   * @returns 指数形式的复数
   */
  static createFromAngle(theta: number): Complex {
    return new Complex(Math.cos(theta), Math.sin(theta))
  }

  /**
   * 从实数创建复数
   * @param real 实数值
   * @returns 新的复数对象
   */
  static fromReal(real: number): Complex {
    return new Complex(real, 0)
  }

  // 实部
  public real: number
  // 虚部
  public imag: number

  /**
   * 构造函数
   * @param real 实部，默认为0
   * @param imag 虚部，默认为0
   */
  constructor(real: number, imag: number) {
    this.real = real
    this.imag = imag
  }

  /**
   * 复数加法：(a + bi) + (c + di) = (a+c) + (b+d)i
   * @param other 另一个复数
   * @returns 相加后的新复数
   */
  add(other: Complex): Complex {
    return new Complex(this.real + other.real, this.imag + other.imag)
  }

  /**
   * 复数减法：(a + bi) - (c + di) = (a-c) + (b-d)i
   * @param other 另一个复数
   * @returns 相减后的新复数
   */
  subtract(other: Complex): Complex {
    return new Complex(this.real - other.real, this.imag - other.imag)
  }

  /**
   * 复数乘法：(a + bi) * (c + di) = (ac-bd) + (ad+bc)i
   * @param other 另一个复数
   * @returns 相乘后的新复数
   */
  multiply(other: Complex): Complex {
    return new Complex(
      this.real * other.real - this.imag * other.imag,
      this.real * other.imag + this.imag * other.real
    )
  }

  /**
   * 复数除以实数
   * @param scalar 实数除数
   * @returns 除法后的新复数
   */
  dividedBy(scalar: number) {
    return new Complex(this.real / scalar, this.imag / scalar)
  }

  /**
   * 计算复数的模长 |a + bi| = sqrt(a² + b²)
   * @returns 复数的模长
   */
  magnitude(): number {
    return Math.sqrt(this.real * this.real + this.imag * this.imag)
  }
}
