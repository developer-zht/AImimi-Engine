import { Transform } from '@/objects/utils/Transform'
import { RenderingMode } from '../../types/RenderingMode'
import { GerstnerWaveMaterialConfig } from '@/materials/water/types/GerstnerWaveMaterialConfig'

export interface GerstnerWaveConfig {
  /** 模型变换 */
  transform: Transform
  /** 材质参数 */
  materialConfig: GerstnerWaveMaterialConfig
  /** 渲染模式 */
  renderingMode: RenderingMode
  /** 水面尺寸 */
  surfaceSize: number
  /** 水面网格数量（分辨率） */
  resolution: number
}
