import { TransformationParams } from '@/objects/types/transformation'

// old & will deprecate
export function setTransform(
  t_x: number,
  t_y: number,
  t_z: number,
  r_x: number = 0,
  r_y: number = 0,
  r_z: number = 0,
  s_x: number,
  s_y: number,
  s_z: number
): TransformationParams {
  return {
    modelTransX: t_x,
    modelTransY: t_y,
    modelTransZ: t_z,
    modelRotateX: r_x,
    modelRotateY: r_y,
    modelRotateZ: r_z,
    modelScaleX: s_x,
    modelScaleY: s_y,
    modelScaleZ: s_z
  }
}
