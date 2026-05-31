import { GerstnerWaveMaterial } from '@/materials/water/GerstnerWaveMaterial'
import { WaterSurface } from '@/objects/WaterSurface'
import { BaseRenderer } from '@/renderers/BaseRenderer'
import { LineRenderer } from '@/renderers/LineRenderer'
import { MeshRenderer } from '@/renderers/MeshRenderer'
import { GerstnerWaveConfig } from '@/scenes/water/simpleWaves/types/GerstnerWaveConfig'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { Shader } from '@/shaders/Shader'

export async function createGerstnerWaveRenderer(
  gl: WebGLRenderingContext,
  config: GerstnerWaveConfig
): Promise<BaseRenderer> {
  const ctx = '[createSineWaveRenderer]'
  const rendererName = 'GerstnerWaveRenderer'

  const { transform, materialConfig, renderingMode, surfaceSize, resolution } = config
  // 1. 创建 Mesh
  const mesh = new WaterSurface(gl, transform, surfaceSize, resolution)

  // 2. 创建 Material
  const material = new GerstnerWaveMaterial(
    `${ctx} SineWaveMaterial<${rendererName}>`,
    materialConfig
  )

  // 3. 加载 Shader
  const shader = await Shader.createShader(
    gl,
    ShaderPaths.GERSTNER_WAVE_VERTEX,
    ShaderPaths.GERSTNER_WAVE_FRAGMENT
  )

  // 4. 组装 Renderer
  if (renderingMode === 'MESH') {
    return new MeshRenderer(gl, mesh, material, shader, `${ctx} ${rendererName}`)
  } else {
    return new LineRenderer(gl, mesh, material, shader, renderingMode, `${ctx} ${rendererName}`)
  }
}
