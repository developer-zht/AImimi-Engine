import { UniformType } from '@/materials/types/Material'

/**
 * 描述 light SH 系数如何映射为 uniforms
 *
 * Order 2（9 coeffs/channel）→ 3 × mat3：
 * {
 *   coeffsPerChannel: 9,
 *   uniformType: UniformType.MATRIX_3FV,
 *   channelNames: ['uLightSH_R', 'uLightSH_G', 'uLightSH_B']
 * }
 *
 * Order 3（16 coeffs/channel）→ 3 × mat4：
 * {
 *   coeffsPerChannel: 16,
 *   uniformType: UniformType.MATRIX_4FV,
 *   channelNames: ['uLightSH_R', 'uLightSH_G', 'uLightSH_B']
 * }
 */
export interface SHLightUniformLayout {
  coeffsPerChannel: number
  uniformType: UniformType
  channelNames: [string, string, string] // R, G, B 固定 3 通道
}
