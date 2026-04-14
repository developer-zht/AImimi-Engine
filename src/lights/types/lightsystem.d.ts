import { ShadowMapFBO } from '../../framebuffers/ShadowMapFBO'
import { ShadowPass } from '../shadow/ShadowPass'

/** 单个光源的阴影资源 */
export interface ShadowEntry {
  shadowMapFBO: ShadowMapFBO
  shadowPass: ShadowPass
}
