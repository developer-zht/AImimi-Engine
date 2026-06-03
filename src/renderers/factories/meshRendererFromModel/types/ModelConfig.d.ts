import { Material } from '@/materials/Material'
import { Uniforms } from '@/materials/types/Material'
import { Transform } from '@/objects/utils/Transform'

export interface ModelConfig {
  name: string
  format: 'obj' | 'gltf'
  path: string

  vertShaderPath: string
  fragShaderPath: string

  transform?: Transform
  transforms?: Transform[]

  /** 除 OBJ 或者 GLTF 模型自带的 uniform 外的自定义 uniform */
  extraUniforms?: Uniforms

  /**
   * 由于所需 material 的 uniform 与模型自带的 uniform 差别过大，因而需要自定义材质
   */
  material?: Material
}
