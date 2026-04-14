import urlJoin from 'url-join'
import { CubeMapImagesConfig } from './types/loadCubeMapImages'
import { TextureLoadError } from '@/errors/EngineError/TextureError/TextureLoadError'

/** 加载 6 张图片，不创建任何 GPU 资源 */
export async function loadCubeMapImages(config: CubeMapImagesConfig): Promise<HTMLImageElement[]> {
  // assets/textures/ 下的 cube map 图片的名字都是 'px', 'nx', 'py', 'ny', 'pz', 'nz'
  const defaultFaceKeys = ['px', 'nx', 'py', 'ny', 'pz', 'nz']
  const faceKeys = config.faceKeys ?? defaultFaceKeys

  const loadImage = async (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () =>
        reject(new TextureLoadError(url, { reason: 'CubeMap face load failed' }))
      image.src = url
    })
  }

  const urls = faceKeys.map((key) => urlJoin(config.basePath, key) + config.extension)
  // console.log(urlJoin(config.basePath, faceKeys[0]!) + config.extension)

  return Promise.all(urls.map(loadImage))
}

// TODO(maybe)
// export function loadCubeMapBitmapImages(config: CubeMapConfig) {
// }
