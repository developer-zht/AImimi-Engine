import { GLTFMeshData } from '@/loaders/types/GLTFMeshData'

export interface GBufferRendererFromGLTFConfig {
  /** 单个 GLTF mesh 数据（由调用方从 loadGLTF 的结果中取出） */
  data: GLTFMeshData

  /** 调试标签 */
  rendererName: string
}
