import { SceneContext } from '@/scenes/types/SceneContext'
import { createRenderer } from './createRenderer'
import { LowResRenderPass } from '@/renderers/passes/lowResolution/LowResRenderPass'
import { ShadertoyUniformManager } from '@/managers/shadertoy/lerrian/cloudsOverSeaAndPeaks/ShadertoyUniformManager'

export async function loadScene(ctx: SceneContext) {
  const { gl, renderer } = ctx

  // 1. 创建 shadertoy renderer
  const meshRenderer = await createRenderer(gl)
  meshRenderer.castShadow = false
  meshRenderer.receiveShadow = false

  // 2. 设置 manager 的 scale
  const manager = meshRenderer.getManager('shadertoyUniformsManager') as ShadertoyUniformManager
  manager.scale = 0.3

  // 3. 创建低分辨率管线
  const scale = 0.3
  const lowResRenderPass = await LowResRenderPass.create(gl, scale)
  lowResRenderPass.addTarget(meshRenderer)

  // 4. 注册 pass
  renderer.addRenderPass(lowResRenderPass)
}
