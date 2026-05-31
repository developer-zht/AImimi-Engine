import { TextureCreationError } from '@/errors/EngineError/TextureError/TextureCreationError'
import { TextureImageSource } from '../../types/texture'

export function loadCubemapFromImages(
  gl: WebGLRenderingContext,
  images: TextureImageSource[]
): WebGLTexture {
  if (images.length !== 6) {
    throw new TextureCreationError('TEXTURE_CUBE_MAP', {
      reason: `CubeMap requires exactly 6 images, got ${images.length}`
    })
  }

  const cubemap = gl.createTexture()
  if (!cubemap) throw new TextureCreationError('TEXTURE_CUBE_MAP')

  const prev = gl.getParameter(gl.TEXTURE_BINDING_CUBE_MAP) as WebGLTexture

  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemap)

  for (let i = 0; i < images.length; i++) {
    const image = images[i]
    if (image) {
      gl.texImage2D(
        gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
      )
    } else {
      throw new TextureCreationError('TEXTURE_CUBE_MAP', {
        reason: 'CubeMap require HTMLImageElement'
      })
    }
  }

  // 设置采样参数
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  // 生成 mipmap + 三线性过滤
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP)
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)

  gl.bindTexture(gl.TEXTURE_CUBE_MAP, prev)

  return cubemap
}
