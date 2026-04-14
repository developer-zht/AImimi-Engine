import { Vec3 } from '@/math/types/math'
import { IPointLight } from './types/pointLight'

export class PointLight implements IPointLight {
  readonly type = 'point' as const

  public position: Vec3
  public color: Vec3
  public intensity: number

  constructor(position: Vec3, color: Vec3, intensity: number) {
    this.position = position
    this.color = color
    this.intensity = intensity
  }

  /** radiance 是计算属性，不是存储字段 */
  get radiance(): Vec3 {
    return [
      this.color[0] * this.intensity,
      this.color[1] * this.intensity,
      this.color[2] * this.intensity
    ]
  }
}
