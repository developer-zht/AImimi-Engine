import { OBJMeshData } from '@/loaders/types/OBJMeshData'

export interface GBufferRendererFromOBJConfig {
  /** 单个 OBJ mesh 数据（由调用方从 loadOBJ 的结果中取出） */
  data: OBJMeshData

  /** 调试标签，如 'cave#0'，会被拼入 Material 和 MeshRenderer 的 name */
  rendererName: string
}
