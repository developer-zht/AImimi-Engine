import { DataTexture } from 'three'

import { CubemapFBO } from '@/framebuffers/CubemapFBO'
import { uploadEquirectTexture2D } from '../shared/uploadEquirectTexture2D'
import { Shader } from '@/shaders/Shader'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { LoadCubemapFromHDROptions } from './types/loadCubemapFromHDR'
import { renderToCubemap } from '../utils/renderToCubemap'

export async function loadCubemapFromHDR(
  gl: WebGLRenderingContext,
  dataTexture: DataTexture,
  options: LoadCubemapFromHDROptions
): Promise<WebGLTexture> {
  const { width } = dataTexture.source.data as { width: number }
  const maxCubeSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE) as number
  const auto = Math.min(2048, maxCubeSize, Math.pow(2, Math.round(Math.log2(width / 4))))
  console.log(auto)

  const resolution = options.resolution ?? auto

  const hdrTexture = uploadEquirectTexture2D(gl, dataTexture)

  const cubemapFBO = new CubemapFBO(gl, {
    resolution,
    format: gl.RGBA,
    type: gl.FLOAT
  })

  const shader = await Shader.createShader(
    gl,
    ShaderPaths.EQUIRECT_TO_CUBEMAP_VERTEX,
    ShaderPaths.EQUIRECT_TO_CUBEMAP_FRAGMENT
  )

  const setupCommonUniforms = (shader: Shader) => {
    shader.setTexture2D('uEquirectangularMap', hdrTexture, 0)
    shader.set1f('uFlipY', options.flipY ? -1.0 : 1.0)
    shader.set1f('uRotationY', (options.rotationY * Math.PI) / 180)
  }

  renderToCubemap(gl, {
    cubemapFBO,
    shader,
    setupCommonUniforms
  })

  cubemapFBO.generateMipmap()
  const cubemap = cubemapFBO.releaseCubemap()
  cubemapFBO.dispose()
  shader.dispose()
  gl.deleteTexture(hdrTexture)

  return cubemap
}
