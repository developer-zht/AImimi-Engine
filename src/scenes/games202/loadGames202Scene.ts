import { SceneContext } from '../types/SceneContext'
import { setupGames202HWSceneGUI } from '@/gui/games202/setup'

export async function loadGames202Scenes(ctx: SceneContext) {
  await setupGames202HWSceneGUI(ctx)
}
