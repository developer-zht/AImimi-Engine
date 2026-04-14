import { ImageTextureExtension } from '@/_config/fileExtensions'

export interface CubeMapImagesConfig {
  basePath: string
  extension: ImageTextureExtension
  faceKeys?: string[] // 默认 ['px', 'nx', 'py', 'ny', 'pz', 'nz']
}
