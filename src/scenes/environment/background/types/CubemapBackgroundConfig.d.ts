import { HDRTextureExtension, ImageTextureExtension } from '@/_config/fileExtensions'
import { Transform } from '@/objects/utils/Transform'

export interface CubemapBackgroundConfig {
  /** cubemap 图片所在目录路径 */
  basePath: string
  /** 文件扩展名，如 '.jpg', '.png', '.hdr' '.exr' */
  extension: ImageTextureExtension | HDRTextureExtension
  /** cubemap 立方体的半径 */
  cubeMapsize: number
  /** 面的 key 名（可选，默认 px/nx/py/ny/pz/nz） */
  faceKeys?: string[]
  /** cubemap transform */
  transform?: Transform
  /** hdr(equirect) 加载时是否翻转 Y 轴（默认 false）。当看到天空上下颠倒时设 true */
  flipY?: boolean
  /** 绕 Y 轴旋转角度（度，默认 0），用来对准太阳方向 */
  rotationY?: number
  /** 曝光强度 */
  exposure?: number
}
