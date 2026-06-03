import { SineWaveMaterial } from '@/materials/water/SineWaveMaterial'
import { WaterSurface } from '@/objects/WaterSurface'
import { BaseRenderer } from '@/renderers/BaseRenderer'
import { LineRenderer } from '@/renderers/LineRenderer'
import { MeshRenderer } from '@/renderers/MeshRenderer'
import { SineWaveConfig } from '@/scenes/water/simpleWaves/types/SineWaveConfig'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { Shader } from '@/shaders/Shader'

export async function createSineWaveRenderer(
  gl: WebGLRenderingContext,
  config: SineWaveConfig
): Promise<BaseRenderer> {
  const ctx = '[createSineWaveRenderer]'
  const rendererName = 'SineWavaRenderer'

  const { transform, materialConfig, renderingMode, surfaceSize, resolution } = config
  // 1. 创建 Mesh
  const mesh = new WaterSurface(gl, transform, surfaceSize, resolution)

  // 2. 创建 Material
  const material = new SineWaveMaterial(`${ctx} SineWaveMaterial<${rendererName}>`, materialConfig)

  // 3. 加载 Shader
  const shader = await Shader.createShader(
    gl,
    ShaderPaths.SINE_WAVE_VERTEX,
    ShaderPaths.SINE_WAVE_FRAGMENT
  )

  // 4. 组装 Renderer
  if (renderingMode === 'MESH') {
    return new MeshRenderer(gl, mesh, material, shader, `${ctx} ${rendererName}`)
  } else {
    return new LineRenderer(gl, mesh, material, shader, renderingMode, `${ctx} ${rendererName}`)
  }
}
