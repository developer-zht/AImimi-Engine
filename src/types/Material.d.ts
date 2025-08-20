export enum UniformType {
  ONE_I = '1i',
  TWO_IV = '2iv',
  THREE_IV = '3iv',

  ONE_F = '1f',
  TWO_FV = '2fv',
  THREE_FV = '3fv',

  MATRIX_4FV = 'matrix4fv',

  TEXTURE_2D = 'texture',
  TEXTURE_CUBE = 'textureCube'
}

export type UniformEntry =
  | { type: UniformType.ONE_I; value: number }
  | { type: UniformType.TWO_IV; value: Int32Array | number[] }
  | { type: UniformType.THREE_IV; value: Int32Array | number[] }
  | { type: UniformType.ONE_F; value: number }
  | { type: UniformType.TWO_FV; value: Float32Array | number[] }
  | { type: UniformType.THREE_FV; value: Float32Array | number[] }
  | { type: UniformType.MATRIX_4FV; value: Float32Array | number[] }
  | { type: UniformType.TEXTURE_2D; value: WebGLTexture | null }
  | { type: UniformType.TEXTURE_CUBE; value: WebGLTexture | null }

export interface Uniforms {
  [name: string]: UniformEntry
}
