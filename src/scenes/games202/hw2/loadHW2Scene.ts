import { MeshRenderer } from '@/renderers/MeshRenderer'
import { createPRTSHRenderer } from '@/renderers/factories/prt/createPRTSHRenderer'
import { ForwardRenderPass } from '@/renderers/passes/forward/ForwardRenderPass'
import { PRTScenePreset } from './types/PRTScenePreset'
import { GUI } from 'dat.gui'
import { SceneContext } from '@/scenes/types/SceneContext'
import { HW2_PRESETS } from './_config/hw2SceneConfig'
import { createCubemapBackground } from '@/scenes/environment/background/createCubemapBackground'
import { mountDatGUI, unmountDatGUI } from '@/gui/_shared/mountGUI'

export async function loadHW2Scene(ctx: SceneContext): Promise<() => void> {
  const { gl, renderer, camera, controls } = ctx

  // ── 相机 ──
  camera.position.set(0, 20, 50)
  controls.target.set(0, 10, 0)

  const folders: GUI[] = []

  // 当前场景持有的 renderer 引用，用于切换时清理
  let activePRTRenderer: MeshRenderer | null = null
  let activeBgRenderer: MeshRenderer | null = null

  // 默认 preset
  const currentPreset = HW2_PRESETS[3]!

  const forwardPass = new ForwardRenderPass()

  // 根据 preset 加载场景
  async function applyPreset(preset: PRTScenePreset): Promise<void> {
    // 清理旧 renderer
    if (activePRTRenderer) {
      forwardPass.deleteTargetRenderer(activePRTRenderer)
      activePRTRenderer.dispose()
      activePRTRenderer = null
    }
    if (activeBgRenderer) {
      forwardPass.deleteTargetRenderer(activeBgRenderer)
      activeBgRenderer.dispose()
      activeBgRenderer = null
    }

    // 创建新 renderer
    activePRTRenderer = await createPRTSHRenderer(gl, {
      modelPath: preset.model.path,
      modelName: preset.model.name,
      prtDataDir: preset.env.dir,
      transportType: preset.model.transportType,
      attributeLayout: preset.sh.attributeLayout,
      meshTransform: preset.model.meshTransform,
      uniformLayout: preset.sh.lightUniformLayout,
      vertShaderPath: preset.sh.vertShaderPath,
      fragShaderPath: preset.sh.fragShaderPath
    })
    // renderer.addRenderer(activePRTRenderer)
    forwardPass.addTargetRenderer(activePRTRenderer)

    activeBgRenderer = await createCubemapBackground(gl, {
      basePath: preset.env.cubemapDir,
      extension: preset.env.cubemapExtension,
      cubeMapsize: 100,
      faceKeys: preset.env.faceKeys
    })
    // renderer.addRenderer(activeBgRenderer)
    forwardPass.addTargetRenderer(activeBgRenderer)
  }

  await applyPreset(currentPreset)

  renderer.addRenderPass(forwardPass)

  const gui = mountDatGUI()

  const folder = gui.addFolder('HW2 PRT-SH')
  const labels = HW2_PRESETS.map((p) => p.label)
  folder.add({ preset: currentPreset.label }, 'preset', labels).onChange((label: string) => {
    const preset = HW2_PRESETS.find((p) => p.label === label)
    if (!preset) return
    applyPreset(preset).catch((err) => {
      console.error('[HW2] Failed to apply preset:', err)
    })
  })
  folder.open()
  folders.push(folder)

  return () => {
    if (activePRTRenderer) activePRTRenderer.dispose()
    if (activeBgRenderer) activeBgRenderer.dispose()
    unmountDatGUI(gui)
  }
}
