import { Transform } from '@/objects/utils/Transform'
import { TextureImageSource } from '@/textures/types/texture'

/**
 * 共享的顶点数据。
 */
interface SharedVertexData {
  name: string
  positions: Float32Array
  normals: Float32Array | null
  uvs: Float32Array | null
  tangents: Float32Array | null
  colors: Float32Array | null
  indices: number[]
  transform: Transform
}

/**
 * 共享的贴图数据。
 *
 * 所有字段都是 | null —— 解析器一定会赋值，只是可能没有数据。
 * 你的引擎 shader 用到哪些就提取哪些，不用的忽略即可。
 */
interface SharedTextureData {
  diffuseImage: TextureImageSource | null // map (baseColor / Kd)
  normalImage: TextureImageSource | null // normalMap
  aoImage: TextureImageSource | null // aoMap
  emissiveImage: TextureImageSource | null // emissiveMap
  displacementImage: TextureImageSource | null // displacementMap
  alphaImage: TextureImageSource | null // alphaMap
}
