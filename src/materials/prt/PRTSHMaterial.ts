import { SHLayoutError } from '@/errors/EngineError/ConfigurationError/SHLayoutError'
import { Material } from '../Material'
import { UniformEntry, Uniforms } from '../types/Material'
import { SHLightUniformLayout } from './types/SHLightUniformLayout'

export class PRTSHMaterial extends Material {
  private layout: SHLightUniformLayout

  constructor(lightSH: number[][], layout: SHLightUniformLayout, label: string) {
    const uniforms = PRTSHMaterial.createLightSHUniforms(lightSH, layout)
    super(label, uniforms)
    this.layout = layout
  }

  /**
   * 根据 layout 将 lightSH[3][N] 转为 uniforms
   */
  static createLightSHUniforms(lightSH: number[][], layout: SHLightUniformLayout): Uniforms {
    // lightSH[0] = R channel 的 9 个 SH 系数
    // lightSH[1] = G channel
    // lightSH[2] = B channel
    // mat3 列主序：col0=[0,1,2], col1=[3,4,5], col2=[6,7,8]
    // 恰好和 SH 系数顺序一致，直接传即可

    if (lightSH.length !== 3) {
      throw new SHLayoutError(
        'data_mismatch',
        `lightSH must have 3 channels, got ${lightSH.length}`,
        { channelCount: lightSH.length }
      )
    }

    const { channelNames, uniformType, coeffsPerChannel } = layout

    const uniforms: Uniforms = {}

    for (let i = 0; i < channelNames.length; i++) {
      const channelData = lightSH[i]
      // channelData 长度不对
      if (channelData?.length !== coeffsPerChannel) {
        throw new SHLayoutError(
          'data_mismatch',
          `lightSH channel ${i} has ${channelData?.length ?? 0} coefficients, expected ${coeffsPerChannel}`,
          { channel: i, actual: channelData?.length ?? 0, expected: coeffsPerChannel }
        )
      }
      uniforms[channelNames[i]!] = {
        type: uniformType,
        value: new Float32Array(channelData)
      } as UniformEntry
    }

    // const uniforms = {
    //   uLightSH_R: {
    //     type: UniformType.MATRIX_3FV,
    //     value: new Float32Array(lightSH[0] ?? [])
    //   },
    //   uLightSH_G: {
    //     type: UniformType.MATRIX_3FV,
    //     value: new Float32Array(lightSH[1] ?? [])
    //   },
    //   uLightSH_B: {
    //     type: UniformType.MATRIX_3FV,
    //     value: new Float32Array(lightSH[2] ?? [])
    //   }
    // }

    return uniforms
  }

  /** 切换环境光时更新 light SH (留给 GUI 使用) */
  updateLightSH(lightSH: number[][]): void {
    const { channelNames, coeffsPerChannel } = this.layout

    for (let i = 0; i < channelNames.length; i++) {
      const uniform = this.uniforms[channelNames[i]!]
      if (!uniform) continue
      const data = lightSH[i]
      if (!data) continue
      uniform.value = new Float32Array(data.slice(0, coeffsPerChannel))
    }
  }
}
