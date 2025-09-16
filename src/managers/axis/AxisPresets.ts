import { setTransform } from '@/utils/transformation'
import { AxisManagerParams } from '@/managers/axis/AxisManager'

export class AxisPreset {
  static createAxis(): AxisManagerParams {
    const axisManagerParams: AxisManagerParams = {
      transformation: setTransform(0, 0, 0, 1, 1, 1, 0, 0, 0)
    }

    return axisManagerParams
  }
}
