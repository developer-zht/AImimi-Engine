import { Vec3 } from '@/math/types/math'
import { Material } from '../Material'
import { UniformType } from '../types/Material'

/**
 * 纯色发光材质，用于光源 Gizmo 的可视化渲染。
 *
 * 将 uLightColor 直接输出为片元颜色，不参与任何光照计算。
 * 配合 lightGizmoShader 使用，在场景中标示光源位置。
 *
 * @example
 * const material = new EmissiveMaterial([1.0, 0.8, 0.6])
 * // 创建一个暖白色的光源指示方块
 */
export class EmissiveMaterial extends Material {
  constructor(lightColor: Vec3) {
    super(
      'EmissiveMaterial',
      {
        uLightColor: { type: UniformType.THREE_FV, value: lightColor }
      },
      null
    )
  }
}
