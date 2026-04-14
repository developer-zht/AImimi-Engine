import { ModelConfig } from '@/renderers/factories/meshRendererFromModel/types/ModelConfig'
import { Vec3 } from '@/math/types/math'
import { ILight } from '@/lights/types/light'
import { LightGUIConfig } from '@/gui/types/setupLightGUI'

/** 相机参数 */
export interface CameraConfig {
  position: Vec3
  target: Vec3
  fov?: number // 默认 75
  near?: number // 默认 0.1
  far?: number // 默认 1000
}

/** 光源列表 */
export interface LightConfig {
  id: string
  light: ILight
  guiConfig?: LightGUIConfig
}

export interface SceneConfig {
  /** 相机参数 */
  cameraConfig: CameraConfig
  /** 模型列表 */
  modelConfigs: ModelConfig[]
  /** 光源列表（可选：Shadertoy 纯屏幕空间场景不需要光） */
  lightConfigs?: LightConfig[]
}
