import type { SHAttributeLayout } from '../types/SHAttributeLayout'

/**
 * Order 2（9 coeffs）→ 3 × vec3
 * 与 vertex.vert 中的 aTransportSH0/1/2 对应
 */
export const SH_ORDER2_LAYOUT: SHAttributeLayout = [
  { name: 'aTransportSH0', size: 3 },
  { name: 'aTransportSH1', size: 3 },
  { name: 'aTransportSH2', size: 3 }
]

/**
 * Order 3（16 coeffs）→ 4 × vec4
 * 与 vertex.vert 中的 aTransportSH0/1/2/3 对应
 */
export const SH_ORDER3_LAYOUT: SHAttributeLayout = [
  { name: 'aTransportSH0', size: 4 },
  { name: 'aTransportSH1', size: 4 },
  { name: 'aTransportSH2', size: 4 },
  { name: 'aTransportSH3', size: 4 }
]
