import { UniformType } from '@/materials/types/Material'
import { SHLightUniformLayout } from '../types/SHLightUniformLayout'
import { SHLayoutError } from '@/errors/EngineError/ConfigurationError/SHLayoutError'

/** uniformType → 唯一合法的 coeffsPerChannel */
const UNIFORM_TYPE_TO_SIZE: Partial<Record<UniformType, number>> = {
  [UniformType.MATRIX_3FV]: 9,
  [UniformType.MATRIX_4FV]: 16
}

/** coeffsPerChannel → 对应的 SH order（必须是完美平方数 - 1 开根） */
function shOrderFromCoeffs(n: number): number | null {
  const root = Math.sqrt(n)
  if (!Number.isInteger(root)) return null
  return root - 1 // (order+1)² = n → order = √n - 1
}

/**
 * 创建并校验 SHLightUniformLayout
 *
 * 在配置阶段就发现不匹配，而不是等到运行时 createUniforms
 */
function createSHLightUniformLayout(
  coeffsPerChannel: number,
  uniformType: UniformType,
  channelNames: [string, string, string] = ['uLightSH_R', 'uLightSH_G', 'uLightSH_B']
): SHLightUniformLayout {
  // 1. coeffsPerChannel 是否是合法的 SH 阶数
  const order = shOrderFromCoeffs(coeffsPerChannel)
  if (order === null || order < 0) {
    throw new SHLayoutError(
      'invalid_coeffs_count',
      `Invalid coeffsPerChannel: ${coeffsPerChannel}. Must be (order+1)²`,
      { coeffsPerChannel }
    )
  }

  // 2. uniformType 是否支持
  const expectedSize = UNIFORM_TYPE_TO_SIZE[uniformType]
  if (expectedSize === undefined) {
    throw new SHLayoutError(
      'unsupported_uniform_type',
      `Unsupported uniformType "${uniformType}" for SH light uniforms`,
      { uniformType, supported: Object.keys(UNIFORM_TYPE_TO_SIZE) }
    )
  }

  // 3. 二者是否匹配
  if (coeffsPerChannel !== expectedSize) {
    throw new SHLayoutError(
      'layout_mismatch',
      `coeffsPerChannel (${coeffsPerChannel}) does not match "${uniformType}" (expects ${expectedSize})`,
      { coeffsPerChannel, uniformType, expectedSize }
    )
  }

  return { coeffsPerChannel, uniformType, channelNames }
}

export const SH_ORDER2_LIGHT_LAYOUT = createSHLightUniformLayout(9, UniformType.MATRIX_3FV)

export const SH_ORDER3_LIGHT_LAYOUT = createSHLightUniformLayout(16, UniformType.MATRIX_4FV)
