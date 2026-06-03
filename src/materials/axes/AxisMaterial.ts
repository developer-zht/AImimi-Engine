import { Material } from '../Material'
import { Uniforms } from '../types/Material'

export class AxisMaterial extends Material {
  constructor(uniforms: Uniforms, label: string) {
    super(label, uniforms, null)
  }
}
