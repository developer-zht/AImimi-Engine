import { CubeMapImagesConfig } from '@/loaders/types/loadCubeMapImages'
import { SceneConfig } from '@/scenes/types/SceneConfig'

type LutName =
  | 'BALL_GGX_E_LUT'
  | 'BALL_GGX_E_MC_LUT'
  | 'BALL_GGX_Eavg_LUT'
  | 'SPHERE_GGX_E_LUT'
  | 'SPHERE_GGX_Eavg_LUT'

export interface BallSceneConfig extends SceneConfig {
  lutPaths: Partial<Record<LutName, string>>
  envCubeMapImagesConfig?: CubeMapImagesConfig
}
