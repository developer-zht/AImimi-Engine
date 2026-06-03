import { Material } from '../Material'
import { Uniforms, UniformType } from '../types/Material'

/**
 * Kulla-Conty BRDF 材质（Cook-Torrance + 多次散射能量补偿）
 *
 * BRDF = F_micro(Cook-Torrance) + F_ms(多散射补偿)
 *
 * 相比 CookTorranceMaterial 多一张纹理：uEavgLut（平均 Fresnel 能量 LUT）
 */
export class KullaContyMaterial extends Material {
  constructor(
    label: string,
    albedoMap: WebGLTexture, // 反照率纹理（纯色 1x1 或真实贴图）
    metallic: number, // 金属度 0~1
    roughness: number, // 粗糙度 0~1
    brdfLutMap: WebGLTexture, // GGX_E_LUT.png 对应的纹理
    eavgLutMap: WebGLTexture, // GGX_Eavg_LUT.png
    envCubeTexture: WebGLTexture // 环境贴图
  ) {
    const uniforms: Uniforms = {
      // 模型自身属性
      uAlbedoMap: { type: UniformType.TEXTURE_2D, value: albedoMap },
      uMetallic: { type: UniformType.ONE_F, value: metallic },
      uRoughness: { type: UniformType.ONE_F, value: roughness },
      // 预计算 LUT
      uBRDFLut: { type: UniformType.TEXTURE_2D, value: brdfLutMap },
      uEavgLut: { type: UniformType.TEXTURE_2D, value: eavgLutMap },
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
