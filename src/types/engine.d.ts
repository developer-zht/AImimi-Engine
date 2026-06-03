import { SceneContext } from '@/scenes/types/SceneContext'

export type SceneLoader = (ctx: SceneContext) => Promise<unknown>
