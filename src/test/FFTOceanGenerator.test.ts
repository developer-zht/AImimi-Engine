import { describe, it, expect } from 'vitest'

import { FFTOceanGenerator } from '@/managers/fftOcean/FFTOceanGenerator'
import { CascadeConfig } from '@/types/fftOcean'
import { computeRMS } from '@/utils/calcComplexRMS'
import { verifyParseval } from '@/utils/verifyParseval'

// ---------- 测试 ----------
describe('FFTOceanGenerator FFT/IFFT 验证', () => {
  it('满足 Parseval 定理 & RMS 比例', () => {
    const cascadeConfig: CascadeConfig = {
      enabled: false, // 是否启用 cascade，true 为 cascade，false 为 single
      targetResolution: 256, // 目标统一分辨率，默认使用最高层分辨率
      targetSize: 1024, // 目标统一范围，默认使用最大范围
      blendMode: 'weighted', // 混合模式：相加或加权
      layerParamsSet: [
        // cascade 层级配置
        {
          size: 1024, // size 米的海面
          resolution: 256, // resolution x resolution 网格
          windSpeed: 12, // windSpeed m/s风速
          windDirection: { x: 2, y: 1 }, // wind direction
          gravity: 9.81,
          choppiness: 2,
          fetch: 500000, // 风区长度 F, 单位米 (m)
          depth: 100,
          amplitude: 1000
        }
      ]
    }
    const time = 0
    const generator = new FFTOceanGenerator(cascadeConfig)
    const cascadeLayerData = generator.getCascadeLayers()[0]

    const { heightSpectrum, heightSpatial } = generator.getTestHeightData(cascadeLayerData, time)

    // 计算 RMS
    const rmsSpatial = computeRMS(heightSpatial)
    const rmsSpectrum = computeRMS(heightSpectrum)

    // Parseval 检查
    const { ok, ratio } = verifyParseval(heightSpatial, heightSpectrum)

    console.log('时域 RMS:', rmsSpatial.toExponential(6))
    console.log('频域 RMS (归一化后):', rmsSpectrum.toExponential(6))
    console.log('Parseval 检查:', ok)
    console.log('RMS Ratio (freq/spatial):', ratio)

    // ---------- 断言 ----------
    expect(ok).toBe(true)
    expect(ratio).toBeCloseTo(1, 10)
    expect(rmsSpectrum / rmsSpatial).toBeCloseTo(256, 10)
  })
})
