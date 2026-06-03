import { GUI } from 'dat.gui'
import { ShadowGUIConfig } from './types/setup'
import { UniformType } from '@/materials/types/Material'
import { BaseRenderer } from '@/renderers/BaseRenderer'

/**
 * 创建阴影参数的 GUI 控件
 *
 * 包含：阴影方法切换（Hard/PCF/PCSS）、PCF 采样半径、光源大小
 * 修改后立即推送到所有 receiveShadow 的 renderer
 *
 * @param gui dat.gui 实例
 * @param getRenderers 获取当前所有 mesh renderer 的函数（延迟求值）
 * @param config 可选配置
 * @returns 创建的 GUI folder
 */
export function setupShadowGUI(
  gui: GUI,
  getRenderers: () => BaseRenderer[],
  config?: ShadowGUIConfig
) {
  const folder = gui.addFolder(config?.name ?? 'Shadow')

  const state = {
    shadowMethod: config?.defaultMethod ?? 2,
    filterRadius: config?.defaultFilterRadius ?? 10
    // lightWorldSize: config?.defaultLightWorldSize ?? 5
  }

  /**
   * 将指定 uniform 推送到所有接收阴影的 renderer
   */
  const pushUniformToShadowReceivers = (
    name: string,
    value: number,
    type: UniformType.ONE_I | UniformType.ONE_F
  ) => {
    for (const renderer of getRenderers()) {
      if (!renderer.receiveShadow) continue
      renderer.updateMaterialUniforms({
        [name]: {
          type,
          value
        }
      })
    }
  }

  // 阴影方法：下拉菜单三选一
  folder
    .add(state, 'shadowMethod', {
      'Hard Shadow': 0,
      PCF: 1,
      PCSS: 2
    })
    .name('Method')
    .onChange((v: number) => {
      pushUniformToShadowReceivers('uShadowMethod', v, UniformType.ONE_I)
    })

  // PCF 采样半径
  folder
    .add(state, 'filterRadius', 1, 50, 1)
    .name('Filter Radius')
    .onChange((v: number) => {
      pushUniformToShadowReceivers('uFilterRadius', v, UniformType.ONE_F)
    })

  // // 光源物理大小（影响 PCSS 软阴影范围）
  // folder
  //   .add(state, 'lightWorldSize', 0.5, 500, 0.5)
  //   .name('Light Size')
  //   .onChange((v: number) => {
  //     pushUniformToShadowReceivers('uLightWorldSize', v, UniformType.ONE_F)
  //   })

  folder.open()
  return folder
}
