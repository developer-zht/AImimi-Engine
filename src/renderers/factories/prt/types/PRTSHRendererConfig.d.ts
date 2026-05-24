import { TransportType } from '@/loaders/types/loadPRT'
import { SHLightUniformLayout } from '@/materials/prt/types/SHLightUniformLayout'
import { SHAttributeLayout } from '@/objects/prt/sphericalHarmonics/types/SHAttributeLayout'
import { Transform } from '@/objects/utils/Transform'

export interface PRTSHRendererConfig {
  // ==================== Model ====================
  /** OBJ 模型路径 */
  modelPath: string
  /** 模型名称（用于 loadOBJ & 拼 transport 文件名） */
  modelName: string
  /** OBJ 加载时的 transform */
  modelTransform?: Transform
  // ==================== SH Data ====================
  /** PRT 数据所在环境目录（包含 light.txt） */
  prtDataDir: string
  /** transport 类型：'unshadowed' | 'shadowed' | 'interreflection' */
  transportType: TransportType
  // ==================== Mesh ====================
  /** SH 系数如何拆分成 vertex attributes */
  attributeLayout: SHAttributeLayout
  /** Mesh 的 world transform */
  meshTransform?: Transform
  // ==================== Material ====================
  uniformLayout: SHLightUniformLayout
  // ==================== Shader ====================
  /** 顶点着色器路径 */
  vertShaderPath: string
  /** 片段着色器路径 */
  fragShaderPath: string
}
