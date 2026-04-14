import { Vec3 } from '@/math/types/math'
import { Transform } from '../utils/Transform'

// export interface Transformation {
//   translate: Vec3
//   scale: Vec3
//   rotate: Vec3
// }

// old & will deprecate
export interface TransformationParams {
  modelTransX: Transform['translate'][0]
  modelTransY: Transform['translate'][1]
  modelTransZ: Transform['translate'][2]
  modelRotateX: Transform['rotate'][0]
  modelRotateY: Transform['rotate'][1]
  modelRotateZ: Transform['rotate'][2]
  modelScaleX: Transform['scale'][0]
  modelScaleY: Transform['scale'][1]
  modelScaleZ: Transform['scale'][2]
}

// Deprecated
// export interface TransformParams {
//   translation: Vec3
//   rotation: Vec3
//   scale: Vec3
// }
