import { HDRTextureExtension, ImageTextureExtension } from '@/_config/fileExtensions'
import { TransportType } from '@/loaders/types/loadPRT'
import { SHLightUniformLayout } from '@/materials/prt/types/SHLightUniformLayout'
import { SHAttributeLayout } from '@/objects/prt/sphericalHarmonics/types/SHAttributeLayout'
import { Transform } from '@/objects/utils/Transform'

/** 一个"可展示的 PRT 组合" */
export interface PRTScenePreset {
  /** GUI 中显示的名称 */
  label: string

  /** 环境光照 */
  env: {
    dir: string // PRT SH 数据目录（含 light.txt + transport_xxx.txt）
    cubemapDir: string // cubemap 图片目录（可能和 dir 相同）
    cubemapExtension: ImageTextureExtension | HDRTextureExtension
    cubeMapsize: number // cubemap 立方体的半径
    faceKeys?: string[]
  }

  /** 模型 */
  model: {
    path: string // OBJ 路径
    name: string // 模型名称（用于拼 transport 文件名）
    transportType: TransportType
    meshTransform: Transform
  }

  /** SH 阶数相关 */
  sh: {
    attributeLayout: SHAttributeLayout
    lightUniformLayout: SHLightUniformLayout
    vertShaderPath: string
    fragShaderPath: string
  }
}
