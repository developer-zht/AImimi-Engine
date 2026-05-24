import { Material } from '@/materials/Material'
import { Uniforms, UniformType } from '@/materials/types/Material'
import { OceanParams } from '@/simulation/ocean/fft/types/OceanParams'
import { FFTOceanMaterialConfig } from './types/FFTOceanMaterialConfig'
import { FFT_OCEAN_MATERIAL_DEFAULTS } from './_config/defaults'

export class FFTOceanMaterial extends Material {
  constructor(
    label: string,
    oceanParamsCascade: OceanParams[],
    config: FFTOceanMaterialConfig = {}
  ) {
    const p: Required<FFTOceanMaterialConfig> = { ...FFT_OCEAN_MATERIAL_DEFAULTS, ...config }

    // console.debug(p)

    const uniforms: Uniforms = {
      // ============================================================
      // 1 相机位置（占位，ForwardRenderPass 每帧注入）
      //   视线 V = normalize(uCameraPos - vWorldPosition)
      // ============================================================
      uCameraPos: { type: UniformType.THREE_FV, value: [0, 0, 0] },

      // ============================================================
      // 2 光照几何（占位，LightSystem 每帧注入）
      //   uLightDir       — shadingDirection = surface → light，即公式里的 L
      //   uLightPos       — 方向光的参考位置（本 shader 不用，备用于阴影）
      //   uLightRadiance  — 光源辐射度 L_i，出现在 specular 与 scatter 里
      // ============================================================
      uLightDir: { type: UniformType.THREE_FV, value: [0, 1, 0] },
      uLightPos: { type: UniformType.THREE_FV, value: [0, 0, 0] },
      uLightRadiance: { type: UniformType.THREE_FV, value: [1, 1, 1] },

      // ============================================================
      // 3 纹理开关（int 0|1，shader 里用 == 1 判断）
      // ============================================================
      uUseDiffuseMap: { type: UniformType.ONE_I, value: p.useDiffuseMap },
      uUseNormalMap: { type: UniformType.ONE_I, value: p.useNormalMap },
      uUseEnvironmentMap: { type: UniformType.ONE_I, value: p.useEnvironmentMap },

      // ============================================================
      // 4 基础贴图（按开关条件注入）
      //   uDiffuseMap      — 备用，本 shader 未使用
      //   uNormalMap       — 备用，法线由 FFT slope/jacobian 计算
      //   uEnvironmentMap  — 立方体贴图，供 textureCube(reflect(-V,N)) 采样
      //                     物理含义：环境辐射度 L_env(ω)，乘 Fresnel 参与最终输出
      // ============================================================
      // ---- 基础纹理（按开关条件注入） ----
      // ...(p.useDiffuseMap && p.diffuseMap
      //   ? { uDiffuseMap: { type: UniformType.TEXTURE_2D, value: p.diffuseMap } }
      //   : {}),
      // ...(p.useNormalMap && p.normalMap
      //   ? { uNormalMap: { type: UniformType.TEXTURE_2D, value: p.normalMap } }
      //   : {}),
      // ...(p.useEnvironmentMap && p.environmentMap
      //   ? { uEnvironmentMap: { type: UniformType.TEXTURE_CUBE, value: p.environmentMap } }
      //   : {}),
      uDiffuseMap: {
        type: UniformType.TEXTURE_2D,
        value: p.useDiffuseMap && p.diffuseMap ? p.diffuseMap : null
      },
      uNormalMap: {
        type: UniformType.TEXTURE_2D,
        value: p.useNormalMap && p.normalMap ? p.normalMap : null
      },
      uEnvironmentMap: {
        type: UniformType.TEXTURE_CUBE,
        value: p.useEnvironmentMap && p.environmentMap ? p.environmentMap : null
      },

      // // ============================================================
      // // 5 水体颜色（均为线性空间 RGB，最后统一 Gamma 2.2）
      // //   uDeepWaterColor     — 深水基色 C_deep，波谷/远处近似
      // //   uShallowWaterColor  — 浅水基色 C_shallow，波峰/浅处近似
      // //   uWaterColor         — 备用统一色（旧逻辑）
      // //   用途：替代 SSS 的 k4 环境散射颜色，或作 base color 混合
      // // ============================================================
      // uWaterColor: { type: UniformType.THREE_FV, value: p.waterColor },
      // uDeepWaterColor: { type: UniformType.THREE_FV, value: p.deepWaterColor },
      // uShallowWaterColor: { type: UniformType.THREE_FV, value: p.shallowWaterColor },
      // ============================================================
      // 5 水体颜色（均为线性空间 RGB，最后统一 Gamma 2.2）
      //   uAmbientColor — 环境散射颜色，作为水体颜色的兜底
      // ============================================================
      uAmbientColor: { type: UniformType.THREE_FV, value: p.ambientColor },

      // ============================================================
      // 6 水体物理参数
      //   uTransparency     — 透明度 α，用于 gl_FragColor.a
      //   uReflectance      — 反射率缩放（艺术控制）
      //   uRefractiveIndex  — 折射率 η（海水≈1.33），参与 F0=((η-1)/(η+1))²
      // ============================================================
      uTransparency: { type: UniformType.ONE_F, value: p.transparency },
      uReflectance: { type: UniformType.ONE_F, value: p.reflectance },
      uRefractiveIndex: { type: UniformType.ONE_F, value: p.refractiveIndex },

      // ============================================================
      // 7 水深模型（目前 shader 未消费，保留兼容）
      // ============================================================
      uDepthModel: { type: UniformType.ONE_I, value: p.depthModel },
      uMaxDepth: { type: UniformType.ONE_F, value: p.maxDepth },
      uMinDepth: { type: UniformType.ONE_F, value: p.minDepth },
      uDepthCenter: { type: UniformType.TWO_FV, value: p.depthCenter },
      uDepthFalloff: { type: UniformType.ONE_F, value: p.depthFalloff },

      // ============================================================
      // 8 Cook-Torrance 参数
      //   uRoughness        — 微表面 RMS 斜率 m，参与
      //                       D: exp(−tan²θ_h/m²)/(π m² (n·h)⁴)
      //                       G: a = (h·o)/(m·sin θ), Λ(a) 的 Schlick 逼近
      //                       F: (1-n·v)^(5·e^(−2.69m)) / (1 + 22.7·m^1.5)
      //   uSpecularPower    — 兼容旧 Blinn-Phong（过渡期保留；完全切换后可删）
      //   uFresnelPower     — 同上，旧 Schlick 的指数
      // ============================================================
      uRoughness: { type: UniformType.ONE_F, value: p.roughness },
      uSpecularPower: { type: UniformType.ONE_F, value: p.specularPower },
      uFresnelPower: { type: UniformType.ONE_F, value: p.fresnelPower },
      uFoamRoughness: { type: UniformType.ONE_F, value: p.foamRoughness },

      // ============================================================
      // 9 Subsurface Scattering 四项强度与颜色
      //   uWavePeakScatterStrength — σ_peak，k1 = σ_peak·H·(L·-V)⁴·(0.5−0.5 L·N)³
      //                              控制逆光波峰透光感
      //   uScatterStrength         — σ_view，k2 = σ_view·(V·N)²
      //                              控制视线垂直穿水体时的体散射
      //   uScatterShadowStrength   — σ_sh，k3 = σ_sh·(N·L)
      //                              类 Lambert 方向散射
      //   uAmbientDensity          — ρ_amb，k4 权重（环境散射强度）
      //   uScatterColor            — C_scatter，k2/k3 使用的散射基色（近似体色）
      //   uScatterPeakColor        — C_peak，k1 使用的波峰透光色（通常偏亮青）
      //   uAmbientColor            — 代替 Unity 的 ShadeSH9；建议填预计算的环境漫反射
      //   uHeightStrength          — H 的缩放（让 k1 可调，匹配 uMagnificationY）
      //   uShadowIntensity         — 阴影软化阈值：softShadow = sat(shadow + lift)
      // ============================================================
      uWavePeakScatterStrength: { type: UniformType.ONE_F, value: p.wavePeakScatterStrength },
      uScatterStrength: { type: UniformType.ONE_F, value: p.scatterStrength },
      uScatterShadowStrength: { type: UniformType.ONE_F, value: p.scatterShadowStrength },
      uAmbientDensity: { type: UniformType.ONE_F, value: p.ambientDensity },
      uScatterColor: { type: UniformType.THREE_FV, value: p.scatterColor },
      uScatterPeakColor: { type: UniformType.THREE_FV, value: p.scatterPeakColor },
      uShadowIntensity: { type: UniformType.ONE_F, value: p.shadowIntensity },

      // ============================================================
      // 10 环境反射强度
      //   uEnvirLightStrength — 乘到 textureCube 上，弥补 HDR 未解码的亮度差
      // ============================================================
      uEnvirLightStrength: { type: UniformType.ONE_F, value: p.envirLightStrength },

      // ============================================================
      // 11 FFT 几何放大
      //   uMagnificationXZ — 水平位移放大（choppiness 额外增益）
      //   uMagnificationY  — 垂直位移放大（波高增益；应与 SSS 的 H 保持一致）
      // ============================================================
      uHeightStrength: { type: UniformType.ONE_F, value: p.heightStrength },
      uNormalStrength: { type: UniformType.ONE_F, value: p.normalStrength }, // 0.2

      // ============================================================
      // 12 远近衰减
      // ============================================================
      uDisplaceDepthAttenuation: { type: UniformType.ONE_F, value: p.displaceDepthAttenuation },
      uFoamDepthAttenuation: { type: UniformType.ONE_F, value: p.foamDepthAttenuation },

      // ============================================================
      // 13 近/远法线过渡
      // ============================================================
      uVarMaskRange: { type: UniformType.ONE_F, value: p.varMaskRange },
      uVarMaskPower: { type: UniformType.ONE_F, value: p.varMaskPower },
      uVarMaskTexScale: { type: UniformType.ONE_F, value: p.varMaskTexScale },

      // ============================================================
      // 14 Foam
      // ============================================================
      uFoamMap: { type: UniformType.TEXTURE_2D, value: null },
      uFoamUVScale: { type: UniformType.ONE_F, value: p.foamUVScale },
      uFoamColor: { type: UniformType.THREE_FV, value: p.foamColor },
      uFoamBias: { type: UniformType.ONE_F, value: p.foamBias },
      uFoamPower: { type: UniformType.ONE_F, value: p.foamPower },
      uFoamAdd: { type: UniformType.ONE_F, value: p.foamAdd },
      uFoamDecayRate: { type: UniformType.ONE_F, value: p.foamDecayRate }
    }

    // ============================================================
    // 15 每层 cascade 的 FFT 贴图与波长 L
    //   uDisplacementMap[i] — (Dx, Dy, Dz, foam)，k1 从 layer0 的 .y 取 H
    //   uGradientMap[i]     — (∂Dy/∂x, ∂Dy/∂z)，重建 meso 法线
    //   uDispDerivativeMap[i] — (∂Dx/∂x, ∂Dz/∂z, ∂Dx/∂z, ∂Dz/∂x)，Jacobian
    //   uLayerSize[i]       — 该层物理波长 L，用于 uv = worldXZ / L
    //   uLayerContribute[i] — 采样侧混合权重（艺术量），默认 1.0
    // ============================================================
    for (let i = 0; i < oceanParamsCascade.length; i++) {
      // ---- FFT Ocean 纹理 ----
      uniforms[`uDisplacementMap${i}`] = { type: UniformType.TEXTURE_2D, value: null }
      uniforms[`uGradientMap${i}`] = { type: UniformType.TEXTURE_2D, value: null }
      uniforms[`uDispDerivativeMap${i}`] = { type: UniformType.TEXTURE_2D, value: null }
      // 采样侧混合权重（艺术量），默认 1.0
      uniforms[`uLayerContribute${i}`] = {
        type: UniformType.ONE_F,
        value: oceanParamsCascade[i]!.layerContribute ?? 1.0
      }
      // ---- FFT Ocean 几何参数 ----
      uniforms[`uLayerSize${i}`] = { type: UniformType.ONE_F, value: 0 }
    }

    super(label, uniforms, null)
  }

  // ---- 运行时更新（供 ComputeManager 每帧调用） ----

  /** 更新 FFT 输出纹理 */
  setDisplacementMap(texture: WebGLTexture): void {
    this.uniforms['uDisplacementMap'] = { type: UniformType.TEXTURE_2D, value: texture }
  }

  setGradientMap(texture: WebGLTexture): void {
    this.uniforms['uGradientMap'] = { type: UniformType.TEXTURE_2D, value: texture }
  }

  setDispDerivativeMap(texture: WebGLTexture): void {
    this.uniforms['uDispDerivativeMap'] = { type: UniformType.TEXTURE_2D, value: texture }
  }

  /** 更新时间（用于 shader 中的动画效果，如泡沫闪烁） */
  setTime(time: number): void {
    this.uniforms['uTime'] = { type: UniformType.ONE_F, value: time }
  }
}
