/**
 * 描述一组 SH 系数如何拆分成 vertex attributes
 *
 * 例如 order 2（9 coeffs）拆成 3 × vec3：
 * [
 *   { name: 'aTransportSH0', size: 3 },  // coeffs 0,1,2
 *   { name: 'aTransportSH1', size: 3 },  // coeffs 3,4,5
 *   { name: 'aTransportSH2', size: 3 },  // coeffs 6,7,8
 * ]
 *
 * 例如 order 3（16 coeffs）拆成 4 × vec4：
 * [
 *   { name: 'aTransportSH0', size: 4 },  // coeffs 0,1,2,3
 *   { name: 'aTransportSH1', size: 4 },  // coeffs 4,5,6,7
 *   { name: 'aTransportSH2', size: 4 },  // coeffs 8,9,10,11
 *   { name: 'aTransportSH3', size: 4 },  // coeffs 12,13,14,15
 * ]
 */

export interface SHAttributeGroup {
  name: string // attribute 名称，需与 shader 一致
  size: number // 每组的系数个数（2 | 3 | 4），对应 vec2/vec3/vec4
}

export type SHAttributeLayout = SHAttributeGroup[]
