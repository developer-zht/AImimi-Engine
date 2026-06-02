import { GUI } from 'dat.gui'
import { LightGUIConfig } from './types/setup'
import { ILight } from '@/lights/types/light'
import { DirectionalLight } from '@/lights/directionalLight/DirectionalLight-refactor'

export function setupLightGUI(
  gui: GUI,
  light: ILight,
  config: LightGUIConfig,
  onWorldSizeChange?: (value: number) => void
): GUI {
  const { name, positionRange } = config
  const { x, y, z } = positionRange

  const folder = gui.addFolder(name)
  folder.add(light.position, '0', x[0], x[1]).name('posX')
  folder.add(light.position, '1', y[0], y[1]).name('posY')
  folder.add(light.position, '2', z[0], z[1]).name('posZ')

  const state = {
    color: [255, 255, 255], // 归一化颜色（0-255 给 dat.gui 用）
    intensity: 10
  }

  folder.addColor(state, 'color').onChange(() => {
    light.radiance = [
      (state.color[0]! / 255) * state.intensity,
      (state.color[1]! / 255) * state.intensity,
      (state.color[2]! / 255) * state.intensity
    ]
  })

  folder
    .add(state, 'intensity', 0, 20)
    .name('intensity')
    .onChange(() => {
      light.radiance = [
        (state.color[0]! / 255) * state.intensity,
        (state.color[1]! / 255) * state.intensity,
        (state.color[2]! / 255) * state.intensity
      ]
    })

  // 暂定：worldSize（仅 DirectionalLight 且配置了范围时显示）
  if (light.type === 'directional' && config.worldSizeRange) {
    const dirLight = light as DirectionalLight
    const [min, max] = config.worldSizeRange

    folder
      .add(dirLight, 'worldSize', min, max)
      .name('world size')
      .onChange((value: number) => {
        dirLight.worldSize = value
        onWorldSizeChange?.(value)
      })
  }

  folder.open()
  return folder
}
