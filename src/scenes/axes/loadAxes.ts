import { createAxesRenderer } from '@/renderers/factories/axes/createAxesRenderer'
import { Transform } from '@/objects/utils/Transform'
import { SceneContext } from '../types/SceneContext'
import { AXES_CONFIG } from './_config/axesCongfig'

export async function loadAxes(ctx: SceneContext) {
  const { gl, renderer } = ctx

  // 加载配置
  const config = AXES_CONFIG

  const lineRenderer = await createAxesRenderer(gl, {
    transform: Transform.identity()
  })

  renderer.addHUDRenderer(lineRenderer, config.position, config.siez)
}
