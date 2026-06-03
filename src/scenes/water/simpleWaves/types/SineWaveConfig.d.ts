import { SineWaveMaterialConfig } from '@/materials/water/types/SineWaveMaterialConfig'
import { Transform } from '@/objects/utils/Transform'
import { RenderingMode } from '../../types/RenderingMode'

export interface SineWaveConfig {
  /** 模型变换 */
  transform: Transform
  /** 材质参数 */
  materialConfig: SineWaveMaterialConfig
  /** 渲染模式 */
  renderingMode: RenderingMode
  /** 水面尺寸 */
  surfaceSize: number
  /** 水面网格数量（分辨率） */
  resolution: number
}
