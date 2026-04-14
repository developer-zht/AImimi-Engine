import { FBO } from './FBO'

/**
 * 深度金字塔（Hierarchical Z-Buffer）
 *
 * 管理 N 级深度 FBO，每级分辨率减半：
 * - Level 0: 全分辨率（直接拷贝 GBuffer depth）
 * - Level 1: 1/2 分辨率（2×2 min reduction）
 * - Level N: 最粗级别
 *
 * 用于 Hi-Z ray marching 加速
 */
export class DepthMipmapFBO {
  private gl: WebGLRenderingContext

  private levelFBOs: FBO[] = []

  /** 每级的宽高信息（用于 shader 中处理奇数边长） */
  private levelDimensions: { width: number; height: number }[] = []

  /**
   * DepthMipmapFBO 构造函数
   *
   * @param gl WebGL 上下文
   * @param fullWidth 全分辨率宽（这里的“full”不代表 canvas.width）
   * @param fullHeight 全分辨率高（这里的“full”不代表 canvas.height）
   */
  constructor(gl: WebGLRenderingContext, fullWidth: number, fullHeight: number) {
    this.gl = gl
    this.createMipmap(fullWidth, fullHeight)
  }

  private createMipmap(fullWidth: number, fullHeight: number): void {
    const gl = this.gl

    // 计算 mipmap 级数：log2(max(w, h)) + 1
    const maxDim = Math.max(fullWidth, fullHeight)
    const maxLevel = 1 + Math.floor(Math.log2(maxDim))

    let w = fullWidth
    let h = fullHeight

    for (let l = 0; l < maxLevel; l++) {
      const fbo = new FBO(gl, {
        width: w,
        height: h,
        colorAttachmentCount: 1,
        depthMode: 'renderbuffer',
        colorTextureConfig: {
          internalFormat: gl.RGBA,
          format: gl.RGBA,
          type: gl.FLOAT,
          minFilter: gl.NEAREST,
          magFilter: gl.NEAREST
        }
      })

      this.levelFBOs.push(fbo)
      this.levelDimensions.push({ width: w, height: h })

      // 下一级减半（至少为 1）
      w = Math.max(1, Math.floor(w * 0.5))
      h = Math.max(1, Math.floor(h * 0.5))
    }
  }

  /** 获取指定级别的 FBO */
  getLevel(index: number): FBO {
    if (index < 0 || index >= this.levelFBOs.length) {
      throw new RangeError(
        `[DepthMipmapFBO] Level index ${index} out of range [0, ${this.levelFBOs.length - 1}]`
      )
    }
    return this.levelFBOs[index]!
  }

  /** 获取所有级别的 FBO */
  getAllLevelFBOs(): readonly FBO[] {
    return this.levelFBOs
  }

  /** 获取指定级别的颜色纹理 */
  getTexture(index: number): WebGLTexture | undefined {
    if (index < 0 || index >= this.levelFBOs.length) {
      throw new RangeError(
        `[DepthMipmapFBO] Level index ${index} out of range [0, ${this.levelFBOs.length - 1}]`
      )
    }
    return this.levelFBOs[index]!.getTexture(0)
  }

  /** 获取指定级别的尺寸 */
  getDimensions(index: number): { width: number; height: number } {
    if (index < 0 || index >= this.levelDimensions.length) {
      throw new RangeError(
        `[DepthMipmapFBO] Level index ${index} out of range [0, ${this.levelDimensions.length - 1}]`
      )
    }
    return this.levelDimensions[index]!
  }

  /** 获取总级数 */
  get levelCount(): number {
    return this.levelFBOs.length
  }

  resize(fullWidth: number, fullHeight: number): void {
    this.clearLevels()
    this.createMipmap(fullWidth, fullHeight)
  }

  private clearLevels() {
    for (const fbo of this.levelFBOs) {
      fbo.dispose()
    }
    this.levelFBOs = []
    this.levelDimensions = []
  }

  dispose(): void {
    this.clearLevels()
  }
}
