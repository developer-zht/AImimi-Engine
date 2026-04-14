import { Material } from '../Material'
import { Uniforms, UniformType } from '../types/Material'

/**
 * Cook-Torrance 微表面 BRDF 材质（单次散射）
 *
 * BRDF = D(GGX) * G(Smith-Schlick) * F(Schlick) / (4 * NdotV * NdotL)
 */
export class CookTorranceMaterial extends Material {
  constructor(
    label: string,
    albedoMap: WebGLTexture, // 反照率纹理（纯色 1x1 或真实贴图）
    metallic: number, // 金属度 0~1
    roughness: number, // 粗糙度 0~1
    brdfLutMap: WebGLTexture, // GGX_E_LUT.png 对应的纹理
    envCubeTexture: WebGLTexture // 环境贴图
  ) {
    const uniforms: Uniforms = {
      // 模型自身属性
      uAlbedoMap: { type: UniformType.TEXTURE_2D, value: albedoMap },
      uMetallic: { type: UniformType.ONE_F, value: metallic },
      uRoughness: { type: UniformType.ONE_F, value: roughness },
      // 预计算 LUT
      uBRDFLut: { type: UniformType.TEXTURE_2D, value: brdfLutMap },
      // 环境贴图（IBL 用）
      uEnvCubeTexture: { type: UniformType.TEXTURE_CUBE, value: envCubeTexture },
      // 每帧由外部推送
      uLightRadiance: { type: UniformType.THREE_FV, value: [0, 0, 0] },
      uLightDir: { type: UniformType.THREE_FV, value: [0, 0, 0] },
      uLightPos: { type: UniformType.THREE_FV, value: [0, 0, 0] }
    }
    super(label, uniforms, null)
  }
}
