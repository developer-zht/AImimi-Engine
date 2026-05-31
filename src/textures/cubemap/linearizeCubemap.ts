import { CubemapFBO } from '@/framebuffers/CubemapFBO'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { Shader } from '@/shaders/Shader'
import { renderToCubemap } from './utils/renderToCubemap'

export async function linearizeCubemap(
  gl: WebGLRenderingContext,
  srcCubemap: WebGLTexture,
  options: { resolution?: number; isSRGB: boolean }
): Promise<WebGLTexture> {
  const cubemapFBO = new CubemapFBO(gl, {
    resolution: options.resolution ?? 512,
    format: gl.RGBA,
    type: gl.FLOAT
  })

  const shader = await Shader.createShader(
    gl,
    ShaderPaths.CUBEMAP_LINEARIZE_VERTEX,
    ShaderPaths.CUBEMAP_LINEARIZE_FRAGMENT
  )

  const setupCommonUniforms = (shader: Shader) => {
    shader.setTextureCube('uSrcCubemap', srcCubemap, 0)
    shader.set1i('uIsSRGB', options.isSRGB ? 1 : 0)
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

  return cubemap
}
