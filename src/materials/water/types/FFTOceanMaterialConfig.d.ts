import { WaterMaterialConfig } from './WaterMaterialConfig'

/** FFT Ocean 特有参数 */
export interface FFTOceanMaterialConfig extends WaterMaterialConfig {
  // FFT 输出纹理（由 ComputePass 绑定，初始为 null）
  displacementMap?: WebGLTexture | null
  gradientMap?: WebGLTexture | null
  dispDerivativeMap?: WebGLTexture | null
}
