export interface ShadowGUIConfig {
  /** GUI folder 名称，默认 'Shadow' */
  name?: string
  /** 默认阴影方法：0=Hard Shadow, 1=PCF, 2=PCSS。默认 2 */
  defaultMethod?: number
  /** 默认 PCF 采样半径（像素），默认 10 */
  defaultFilterRadius?: number
  /** 默认光源物理大小（PCSS 用），默认 5 */
  // defaultLightWorldSize?: number
}
