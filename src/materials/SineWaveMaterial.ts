import { getShaderString } from '@/loaders/loadShader'
import { WaterMaterial, WaterMaterialParams } from '@/materials/WaterMaterial'
import { Uniforms } from '@/types/Material'

// 正弦波特有的参数接口
export interface SineWaveParams extends WaterMaterialParams {
  // 正弦波控制参数
  amplitude: number
  waveVector: number
  angularFrequency: number
  // speed: number

  // 多层波浪参数
  // layerWeights?: number[] // 各层权重
  // layerSpeeds?: number[] // 各层速度
  // layerDirections?: number[][] // 各层方向向量
  // waveVectorCoefficient?: number[] // 波矢 k 的系数（倍数）
  // angularFrequencyCoefficient?: number[] // 角频率 ω 的系数（倍数）
}

// 正弦波水体材质类
export class SineWaveMaterial extends WaterMaterial {
  private sineWaveParameters: SineWaveParams

  constructor(
    sineWaveParams: SineWaveParams,
    vertexShaderContent: string,
    fragmentShaderContent: string
  ) {
    // 设置正弦波默认参数
    let defaultSineWaveParameters: SineWaveParams = {
      // 纹理使用标志
      useDiffuseMap: 0,
      useNormalMap: 0,
      useEnvironmentMap: 0,
      // 基础纹理
      diffuseMap: null,
      normalMap: null,
      environmentMap: null,
      // 水体颜色参数
      waterColor: [0.1, 0.3, 0.5],
      deepWaterColor: [0.0, 0.1, 0.2],
      shallowWaterColor: [0.2, 0.6, 0.8],
      // 水体物理参数
      transparency: 0.8,
      reflectance: 0.3,
      refractiveIndex: 1.33,
      // 波浪控制参数
      time: 0.0,
      // 光照参数
      specularPower: 32.0,
      fresnelPower: 5.0,

      // 正弦波控制参数
      amplitude: 1.0,
      waveVector: 1.0,
      angularFrequency: 2 * Math.PI
    }
    const sineWaveParameters = {
      ...defaultSineWaveParameters,
      // 作用：覆盖默认值
      ...sineWaveParams
    }

    // 构建正弦波特有的uniforms
    const sineWaveUniforms: Uniforms = {
      // 正弦波基础参数
      uAmplitude: { type: '1f', value: sineWaveParameters.amplitude }, // A
      uWaveVector: { type: '1f', value: sineWaveParameters.waveVector }, // k
      uAngularFreq: { type: '1f', value: sineWaveParameters.angularFrequency } // ω
    }

    super(sineWaveParameters, vertexShaderContent, fragmentShaderContent, sineWaveUniforms)

    this.sineWaveParameters = sineWaveParameters
  }

  // 设置振幅
  setAmplitude(amplitude: number) {
    this.sineWaveParameters.amplitude = amplitude
    this.uniforms['uAmplitude'].value = amplitude
  }

  // 设置波矢
  setWaveVector(waveVector: number) {
    this.sineWaveParameters.waveVector = waveVector
    this.uniforms['uWaveVector'].value = waveVector
  }

  // 设置角频率
  setAngularFrequency(omega: number) {
    this.sineWaveParameters.angularFrequency = omega
    this.uniforms['uAngularFrequency'].value = omega
  }

  // 获取正弦波参数
  getSineWaveParams() {
    return { ...this.sineWaveParameters }
  }
}

export async function buildSineWaveMaterial(
  sineWaveParams: SineWaveParams,
  vertexPath: string,
  fragmentPath: string
): Promise<SineWaveMaterial> {
  let vertexShaderContent = await getShaderString(vertexPath)
  let fragmentShaderContent = await getShaderString(fragmentPath)

  return new SineWaveMaterial(sineWaveParams, vertexShaderContent, fragmentShaderContent)
}
