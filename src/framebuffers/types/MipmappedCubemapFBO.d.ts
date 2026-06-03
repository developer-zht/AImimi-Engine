/**
 * 支持 mip-level 绑定的 cubemap FBO。
 *
 * 与 src/framebuffers/CubemapFBO.ts 的区别：
 *   - 创建时为每个 mip level 都分配 6 个面的存储
 *   - bindFace(face, mip) 把指定 mip + face 绑到 COLOR_ATTACHMENT0，自动切对应分辨率的 viewport
 *
 * 用于 prefilterEnvironment：每个 mip 对应一个 roughness，分别渲染。
 */
export interface MipmappedCubemapFBOOptions {
  baseResolution: number // mip 0 边长，必须是 2 的幂
  numMips: number // 总 mip 层数（含 mip 0）
  format: number
  type: number
}
