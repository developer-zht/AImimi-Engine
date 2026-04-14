import { mat4 } from 'gl-matrix'
import { Material } from '../Material'
import { UniformType } from '../types/Material'

/**
 * GBuffer 材质
 *
 * 声明 GBuffer shader 的 4 个 uniform：
 * - uKd：漫反射纹理（模型 MTL 中的 map_Kd，由 OBJ loader 加载）
 * - uNt：法线贴图（模型 MTL 中的 map_bump/norm，由 OBJ loader 加载）
 * - uShadowMap：Shadow Pass 输出的深度纹理（每帧由外部推送）
 * - uLightVP：光源 ViewProjection 矩阵（每帧由外部推送）
 *
 * 与 DirectLightMaterial 的区别：
 * DirectLightMaterial 输出最终颜色到 gl_FragColor（前向渲染）
 * GBufferMaterial 输出几何信息到 gl_FragData[0..4]（延迟渲染）
 */
export class GBufferMaterial extends Material {
  constructor(
    label: string,
    diffuseTexture: WebGLTexture, // OBJ loader 从 MTL 的 map_Kd 加载的图片
    normalMapTexture: WebGLTexture // OBJ loader 从 MTL 的 map_bump 加载的图片
  ) {
    super(
      label,
      {
        // ==================== 模型自身属性（构造时确定）====================
        // vec3 kd = texture2D(uKd, vTextureCoord).rgb，写入 gl_FragData[0]
        uKd: { type: UniformType.TEXTURE_2D, value: diffuseTexture },
        // vec3 nt = texture2D(uNt, vTextureCoord).xyz * 2.0 - 1.0，经 ApplyTangentNormalMap() 变换后写入 gl_FragData[2]
        uNt: { type: UniformType.TEXTURE_2D, value: normalMapTexture },

        // ==================== 每帧由外部推送的属性（标志性占位） ====================
        // SimpleShadowMap() / PCSS 采样此纹理比较深度，结果写入 gl_FragData[3]
        uShadowMap: { type: UniformType.TEXTURE_2D, value: null },
        // uLightVP，用于将世界坐标变换到光源空间以采样 shadow map
        uLightVP: { type: UniformType.MATRIX_4FV, value: mat4.create() },
        // 用于判断 uShadowMap 存储深度数据的格式
        uUseDepthTexture: { type: UniformType.ONE_I, value: 0 },

        // PCSS 需要的参数
        // 光源位置
        uLightPos: { type: UniformType.THREE_FV, value: [0, 0, 0] },
        // shadow map 分辨率
        uShadowMapSize: { type: UniformType.ONE_F, value: 0 },
        // 正交投影总宽度（orthoSize * 2）
        uFrustumSize: { type: UniformType.ONE_F, value: 0 },
        // 近裁剪面
        uLightNearPlane: { type: UniformType.ONE_F, value: 0 },
        // 光源物理大小
        uLightWorldSize: { type: UniformType.ONE_F, value: 0 }
      },
      null
    )
  }
}
