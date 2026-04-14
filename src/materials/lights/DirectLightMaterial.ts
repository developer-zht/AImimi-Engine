import type { Vec3 } from '@/math/types/math'
import { Material } from '../Material'
import { UniformType } from '../types/Material'
import { mat4 } from 'gl-matrix'

export class DirectLightMaterial extends Material {
  constructor(diffuseTexture: WebGLTexture, specular: Vec3) {
    super(
      'DirectLightMaterial',
      {
        // ---- 物体自身属性（构造时确定）----
        uSampler: { type: UniformType.TEXTURE_2D, value: diffuseTexture },
        uKs: { type: UniformType.THREE_FV, value: specular },

        // ---- 光照属性（LightSystem 每帧推送，这里只是占位）----
        uLightRadiance: { type: UniformType.THREE_FV, value: [0, 0, 0] },
        uShadowMap: { type: UniformType.TEXTURE_2D, value: null },
        uLightMVP: { type: UniformType.MATRIX_4FV, value: mat4.create() }
      },
      null
    )
  }
}
