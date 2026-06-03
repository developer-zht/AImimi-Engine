export interface CubemapFBOOptions {
  resolution: number
  /** 默认 gl.RGBA */
  format?: number
  /** 默认 gl.FLOAT（HDR 友好），LDR 路径可传 gl.UNSIGNED_BYTE */
  type?: number
  /** 加载完是否生成 mipmap，默认 true */
  // generateMipmap?: boolean
}
