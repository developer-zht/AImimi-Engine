// =============== CubeMapRenderManager ===============
export enum CubeMapType {
  SKYBOX = 'skybox'
}

export interface CubeMapRenderManagerParams {
  // 几何参数
  transformation: TransformationParams

  // Texture 文件类型
  // textureType: TextureType
  texture: WebGLTexture

  // 网格类型 / 渲染类型
  cubeMapType: CubeMapType
}

// =============== CubeMapPreset ===============
export enum TextureType {
  IMG_CUBE_MAP = 'image', // 已经分割好的 cubemap
  HDR_CUBE_MAP = 'hdrFile' // 需要从 .hdr/.exr 转换到 cubemap
}
