import { ShadertoyUniformManager } from '@/managers/shadertoy/lerrian/cloudsOverSeaAndPeaks/ShadertoyUniformManager'
import { Material } from '@/materials/Material'
import { UniformType } from '@/materials/types/Material'
import { FullScreenQuad } from '@/objects/FullScreenQuad'
import { MeshRenderer } from '@/renderers/MeshRenderer'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { Shader } from '@/shaders/Shader-refactor'

export async function createRenderer(gl: WebGLRenderingContext): Promise<MeshRenderer> {
  const ctx = '[Lerrian createRenderer]'
  const rendererName = 'CloudsOverSeaAndPeaks'

  const mesh = new FullScreenQuad(gl, `${ctx} FullScreenQuad<${rendererName}>`)

  const material = new Material(`${ctx} Material<${rendererName}>`, {
    iResolution: { type: UniformType.THREE_FV, value: [gl.canvas.width, gl.canvas.height, 1] },
    iTime: { type: UniformType.ONE_F, value: 0 },
    iMouse: { type: UniformType.FOUR_FV, value: [0, 0, 0, 0] }
  })

  const shader = await Shader.createShader(
    gl,
    ShaderPaths.SHADERTOY_COMMON_VERTEX,
    ShaderPaths.SHADERTOY_LERRAIN_CLOUD_OVER_SEA_AND_PEAK_FRAGMENT
  )

  const renderer = new MeshRenderer(
    gl,
    mesh,
    material,
    shader,
    '[Lerrian CloudsOverSeaAndPeaks] MeshRenderer'
  )

  const manager = new ShadertoyUniformManager(renderer, gl.canvas as HTMLCanvasElement)

  renderer.addManager(manager)

  return renderer
}
