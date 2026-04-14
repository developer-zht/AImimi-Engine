import { ResourceLoadError } from '@/errors/EngineError/ResourceError/ResourceLoadError'

export async function loadImageAsync(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img: HTMLImageElement = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new ResourceLoadError('image', url))
    img.src = url
  })
}
