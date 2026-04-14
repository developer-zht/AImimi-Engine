import { beforeEach, describe, expect, it } from 'vitest'
import * as math from 'mathjs'
import { Complex } from '@/math/Complex'

describe('Custom Complex Validation', () => {
  let customA: Complex
  let customB: Complex

  let mathjsA: math.Complex
  let mathjsB: math.Complex

  beforeEach(() => {
    customA = new Complex(3, 4) // 3 + 4i
    customB = new Complex(1, -2) // 1 - 2i

    mathjsA = math.complex(3, 4)
    mathjsB = math.complex(1, -2)
  })

  it('add() 应等价于 mathjs 的加法', () => {
    const customResult = customA.add(customB)
    const mathjsResult = math.add(mathjsA, mathjsB)
    expectCloseToMath(customResult, mathjsResult)
  })

  it('subtract() 应等价于 mathjs 的减法', () => {
    const customResult = customA.subtract(customB)
    const mathjsResult = math.subtract(mathjsA, mathjsB)
    expectCloseToMath(customResult, mathjsResult)
  })

  it('multiply() 应等价于 mathjs 的乘法', () => {
    const customResult = customA.multiply(customB)
    const mathjsResult = math.multiply(mathjsA, mathjsB) as math.Complex
    expectCloseToMath(customResult, mathjsResult)
  })

  it('multiplyByScalar() 应等价于 mathjs 的数乘', () => {
    const customResult = customA.multiplyByScalar(2)
    const mathResult = math.multiply(mathjsA, 2) as math.Complex
    expectCloseToMath(customResult, mathResult)
  })

  it('dividedBy() 应等价于 mathjs 的除法', () => {
    const customResult = customA.dividedByScalar(2)
    const mathResult = math.divide(mathjsA, 2) as math.Complex
    expectCloseToMath(customResult, mathResult)
  })

  it('magnitude() 应等价于 mathjs 的 abs()', () => {
    expect(customA.magnitude()).toBeCloseTo(math.abs(mathjsA), 1e-10)
    expect(customB.magnitude()).toBeCloseTo(math.abs(mathjsB), 1e-10)
  })

  it('conjugate() 应等价于 mathjs 的 abs()', () => {
    const customResult = customA.conjugate()
    const mathResult = math.conj(mathjsA)
    expectCloseToMath(customResult, mathResult)
  })

  // =============== Helper ===============
  function expectCloseToMath(cusComplex: Complex, mathComplex: math.Complex, eps: number = 1e-10) {
    expect(cusComplex.real).toBeCloseTo(mathComplex.re, eps)
    expect(cusComplex.imag).toBeCloseTo(mathComplex.im, eps)
  }
})
