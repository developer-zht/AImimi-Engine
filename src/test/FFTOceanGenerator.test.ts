import { describe, it, expect } from 'vitest'

import { FFTOceanGenerator } from '@/managers/fftOcean/FFTOceanGenerator'
import { OceanParams } from '@/types/fftOcean'
import { computeRMS } from '@/utils/calcComplexRMS'
import { verifyParseval } from '@/utils/verifyParseval'

// ---------- 测试 ----------
describe('FFTOceanGenerator FFT/IFFT 验证', () => {
  it('满足 Parseval 定理 & RMS 比例', () => {
    const oceanParams: OceanParams = {
      size: 1024, // 512米的海面
      resolution: 256, // 256x256网格
      windSpeed: 8, // 10m/s风速
      windDirection: { x: 2, y: 1 }, // 东风
      gravity: 9.81,
      choppiness: 2,
      fetch: 1000,
      // depth: 100,
      amplitude: 1
    }
    const generator = new FFTOceanGenerator(oceanParams)

    // 生成频域数据（heightSpectrum）
    const heightSpectrum = generator.generateInitialSpectrum(0) // 假设有这样的方法
    // 执行 IFFT 得到时域数据
    const heightSpatial = generator.fftProcessor.ifft1DInterface()

    // 计算 RMS
    const rmsSpatial = computeRMS(heightSpatial)
    const rmsSpectrum = computeRMS(heightSpectrum)

    // Parseval 检查
    const { ok, ratio } = verifyParseval(heightSpatial, heightSpectrum)

    console.log('时域 RMS:', rmsSpatial.toExponential(6))
    console.log('频域 RMS (归一化后):', rmsSpectrum.toExponential(6))
    console.log('Parseval 检查:', ok)
    console.log('RMS Ratio (freq/spatial):', ratio)
  })
})
