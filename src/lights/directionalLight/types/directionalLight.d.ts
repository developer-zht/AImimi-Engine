import { ILight } from '@/lights/types/light'
import { Vec3 } from '@/math/types/math'
import { IDirectionalShadow } from '@/renderers/passes/shadow/types/shadow'

export interface IDirectionalLight extends ILight, IDirectionalShadow {
  type: 'directional'
  direction: Vec3 // 光线传播方向（position → target）
  shadingDirection: Vec3 // 着色方向（-direction，从表面指向光源）
  up: Vec3
}
