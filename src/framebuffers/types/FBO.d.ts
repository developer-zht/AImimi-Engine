/** FBO 配置选项 */
export interface FBOOptions {
  width: number
  height: number
  /** color attachment 数量，默认 1 */
  colorAttachmentCount?: number
  /**
   * 深度附件模式：
   * - 'renderbuffer'（默认）：用 renderbuffer 存深度，不可采样，仅用于深度测试
   * - 'texture'：用 depth texture 存深度，可在 shader 中采样
   *
   * 注意：'texture' 模式需要 WEBGL_depth_texture 扩展
   */
  depthMode?: 'renderbuffer' | 'texture'

  /**
   * Color attachment 的纹理配置
   * 不传则使用默认值（适用于大多数 G-Buffer / 后处理场景）
   */
  colorTextureConfig?: ColorTextureConfig
}

export interface ColorTextureConfig {
  /** 内部格式，默认 gl.RGBA */
  internalFormat?: GLenum
  /** 数据格式，默认 gl.RGBA */
  format?: GLenum
  /** 数据类型，默认 gl.UNSIGNED_BYTE */
  type?: GLenum
  /** 缩小过滤，默认 NEAREST */
  minFilter?: GLenum
  /** 放大过滤，默认 NEAREST */
  magFilter?: GLenum
  /** S 方向环绕，默认 CLAMP_TO_EDGE */
  wrapS?: GLenum
  /** T 方向环绕，默认 CLAMP_TO_EDGE */
  wrapT?: GLenum
}
