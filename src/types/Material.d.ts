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

export interface Uniforms {
  [name: string]: { type: UniformType; value: any }
}
