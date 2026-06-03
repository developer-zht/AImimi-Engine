import { getCapabilities } from '@/_config/glCapabilities'
import { MipmappedCubemapFBO } from '@/framebuffers/MipmappedCubemapFBO'
import { createCubeVBO } from '../shared/createCubeVBO'
import { Shader } from '@/shaders/Shader'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { mat4 } from 'gl-matrix'
import { getCaptureViewMatrices } from '../shared/getCaptureViewMatrices'
import { drawCube } from '../shared/drawCube'
import { PrefilterEnvironmentOptions } from './types/prefilterEnvironment'
import { captureGLState, restoreGLState, setCleanBakeState } from '@/utils/gl/withCleanGLState'

/**
 * 用 GGX 重要性采样把 envmap 卷积成"按 roughness 分 mip"的 prefiltered cubemap。
 *
 * 数学：
 *   prefilter[mip](dir) = ∫ over hemisphere [ GGX(roughness(mip), L, V=R=N=dir) ] · envMap(L) dL
 *
 * Karis 近似：假设 V == R == N，把 4D 积分降到 2D，
 *           精度损失换 ~1024 倍加速。
 */
export async function prefilterEnvironment(
  gl: WebGLRenderingContext,
  srcCubemap: WebGLTexture,
  options: PrefilterEnvironmentOptions = {}
): Promise<WebGLTexture> {
  const baseResolution = options.baseResolution ?? 256
  const numMips = options.numMips ?? 5
  const sampleCount = options.sampleCount ?? 1024
  const fireflyClamp = options.fireflyClamp ?? 20.0 // HDR 单像素亮度上限；-1 = 禁用；推荐 20（晴天）/40（弱光场景）

  const fbo = new MipmappedCubemapFBO(gl, {
    baseResolution,
    numMips,
    format: gl.RGBA,
    type: getCapabilities().floatTexture ? gl.FLOAT : gl.UNSIGNED_BYTE
  })

  const cubeVBO = createCubeVBO(gl)

  const shader = await Shader.createShader(
    gl,
    ShaderPaths.IBL_PREFILTER_VERTEX,
    ShaderPaths.IBL_PREFILTER_FRAGMENT
  )

  const modelMatrix = mat4.create()
  const viewMatrices = getCaptureViewMatrices()
  const projectionMatrix = mat4.perspective(mat4.create(), Math.PI / 2, 1.0, 0.1, 10)

  const saved = captureGLState(gl)
  setCleanBakeState(gl)

  shader.use()
  shader.setMat4('uModelMatrix', modelMatrix)
  shader.setMat4('uProjectionMatrix', projectionMatrix)
  shader.setTextureCube('uSrcCubemap', srcCubemap, 0)
  shader.set1i('uSampleCount', sampleCount)
  shader.set1f('uFireflyClamp', fireflyClamp)

  const fullMipCount = Math.floor(Math.log2(baseResolution)) + 1

  for (let mip = 0; mip < fullMipCount; mip++) {
    // const roughness = numMips > 1 ? mip / (numMips - 1) : 0.0
    // roughness 在 mip >= numMips 之后 clamp 到 1.0（最糊）
    const roughness = mip < numMips ? mip / (numMips - 1) : 1.0
    shader.set1f('uRoughness', roughness)

    for (let face = 0; face < 6; face++) {
      fbo.bindFace(face, mip)
      gl.clear(gl.COLOR_BUFFER_BIT)

      shader.setMat4('uViewMatrix', viewMatrices[face]!)

      drawCube(gl, cubeVBO, shader)
    }
  }

  restoreGLState(gl, saved)

  const result = fbo.releaseCubemap()
  fbo.dispose()
  shader.dispose()
  gl.deleteBuffer(cubeVBO)

  return result
}
