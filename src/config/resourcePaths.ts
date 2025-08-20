// 基础路径
const BASES = {
  shaders: import.meta.env.VITE_SHADER_BASE,
  textures: import.meta.env.VITE_TEXTURE_BASE
}

// 纹理资源路径配置
export const TexturePaths = {
  // 天空盒
  SKY_09_CUBEMAP: `${BASES.textures}/skyboxes/sky_09_cubemap`,
  SKY_18_CUBEMAP: `${BASES.textures}/skyboxes/sky_18_cubemap`,
  QWANTANI_MOONRISE_PURESKY_2K_EXR: `${BASES.textures}/environment/skies/qwantani_moonrise_puresky_2k/puresky.exr`,
  QWANTANI_MOONRISE_PURESKY_2K_HDR: `${BASES.textures}/environment/skies/qwantani_moonrise_puresky_2k/puresky.hdr`,
  EVENING_SKY_HDRI039B_EXR: `${BASES.textures}/environment/skies/EveningSkyHDRI039B/EveningSkyHDRI039B_2K-HDR.exr`
}

// Shader 路径配置
export const ShaderPaths = {
  DIRECT_LIGHT_VERTEXT: `${import.meta.env.VITE_SHADER_BASE}/directLightShader/directVertex.glsl`,
  DIRECT_LIGHT_FRAGMENT: `${import.meta.env.VITE_SHADER_BASE}/directLightShader/directFragment.glsl`,
  FFT_OCEAN_VERTEX: `${import.meta.env.VITE_SHADER_BASE}/fftOceanShader/FFTOceanVertex.glsl`,
  FFT_OCEAN_FRAGMENT: `${import.meta.env.VITE_SHADER_BASE}/fftOceanShader/FFTOceanFragment.glsl`,
  GBUFFER_VERTEX: `${import.meta.env.VITE_SHADER_BASE}/gbufferShader/gbufferVertex.glsl`,
  GBUFFER_FRAGMENT: `${import.meta.env.VITE_SHADER_BASE}/gbufferShader/gbufferFragment.glsl`,
  EQUIRECT_TO_CUBEMAP_VERTEX: `${import.meta.env.VITE_SHADER_BASE}/IBLShader/equirectToCubemapShader/EquirectToCubemapVertex.glsl`,
  EQUIRECT_TO_CUBEMAP_FRAGMENT: `${import.meta.env.VITE_SHADER_BASE}/IBLShader/equirectToCubemapShader/EquirectToCubemapFragment.glsl`,
  IRRADIANCE_VERTEX: `${import.meta.env.VITE_SHADER_BASE}/IBLShader/irradianceShader/IrradianceVertex.glsl`,
  IRRADIANCE_FRAGMENT: `${import.meta.env.VITE_SHADER_BASE}/IBLShader/irradianceShader/IrradianceVertex.glsl`,
  LIGHT_VERTEX: `${import.meta.env.VITE_SHADER_BASE}/lightShader/lightCubeVertexShader.glsl`,
  LIGHT_FRAGMENT: `${import.meta.env.VITE_SHADER_BASE}/lightShader/lightCubeFragment.glsl`,
  SCENE_DEPTH_VERTEX: `${import.meta.env.VITE_SHADER_BASE}/sceneDepthShader/depthVertex.glsl`,
  SCENE_DEPTH_FRAGMENT: `${import.meta.env.VITE_SHADER_BASE}/sceneDepthShader/depthFragment.glsl`,
  SHADOW_VERTEX: `${import.meta.env.VITE_SHADER_BASE}/shadowShader/shadowVertex.glsl`,
  SHADOW_FRAGMENT: `${import.meta.env.VITE_SHADER_BASE}/shadowShader/shadowFragment.glsl`,
  SKYBOX_VERTEX: `${import.meta.env.VITE_SHADER_BASE}/skyboxShader/SkyboxVertex.glsl`,
  SKYBOX_FRAGMENT: `${import.meta.env.VITE_SHADER_BASE}/skyboxShader/SkyboxFragment.glsl`,
  SSR_VERTEX: `${import.meta.env.VITE_SHADER_BASE}/ssrShader/ssrVertex.glsl`,
  SSR_FRAGMENT: `${import.meta.env.VITE_SHADER_BASE}/ssrShader/ssrFragment.glsl`,
  SINE_WAVE_VERTEX: `${import.meta.env.VITE_SHADER_BASE}/waterShader/SinWaveVertex.glsl`,
  SINE_WAVE_FRAGMENT: `${import.meta.env.VITE_SHADER_BASE}/waterShader/SinWaveFragment.glsl`,
  GERSTNER_WAVE_VERTEX: `${import.meta.env.VITE_SHADER_BASE}/waterShader/GerstnerWaveVertex.glsl`,
  GERSTNER_WAVE_FRAGMENT: `${import.meta.env.VITE_SHADER_BASE}/waterShader/GerstnerWaveFragment.glsl`
}

// 文件扩展名配置
export enum FileExtensions {
  PNG = '.png',
  JPG = '.jpg',
  WEBP = '.webp',
  HDR = '.hdr',
  GLSL = '.glsl',
  OBJ = '.obj',
  MTL = '.mtl'
}

// 预定义的 CubeMap 配置
// export const CubeMapConfigs = {
//   SKY_09: {
//     basePath: TexturePaths.SKY_09_CUBEMAP,
//     extension: FileExtensions.PNG
//   } as CubeMapConfig
// } as const

// 着色器配置
export const ShaderConfigs = {
  SKYBOX: {
    vertex: ShaderPaths.SKYBOX_VERTEX,
    fragment: ShaderPaths.SKYBOX_FRAGMENT
  }
} as const

// 使用示例
export class ResourceManager {
  // 获取 CubeMap 配置
  // static getCubeMapConfig(type: keyof typeof CubeMapConfigs): CubeMapConfig {
  //   return CubeMapConfigs[type]
  // }

  // 获取着色器配置
  static getShaderConfig(type: keyof typeof ShaderConfigs) {
    return ShaderConfigs[type]
  }

  // 构建完整的纹理路径
  static buildTexturePath(basePath: string, filename: string, extension: FileExtensions): string {
    return `${basePath}${filename}${extension}`
  }
}
