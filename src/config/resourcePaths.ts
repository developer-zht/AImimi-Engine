import urlJoin from 'url-join'

// 基础路径
const BASES = {
  shaders: urlJoin(import.meta.env.BASE_URL, import.meta.env.VITE_SHADER_BASE),
  textures: urlJoin(import.meta.env.BASE_URL, import.meta.env.VITE_TEXTURE_BASE)
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
  // Direct Light
  DIRECT_LIGHT_VERTEXT: `${BASES.shaders}/directLightShader/directVertex.glsl`,
  DIRECT_LIGHT_FRAGMENT: `${BASES.shaders}/directLightShader/directFragment.glsl`,
  // Light
  LIGHT_VERTEX: `${BASES.shaders}/lightShader/lightCubeVertexShader.glsl`,
  LIGHT_FRAGMENT: `${BASES.shaders}/lightShader/lightCubeFragment.glsl`,
  // G-Buffer
  GBUFFER_VERTEX: `${BASES.shaders}/gbufferShader/gbufferVertex.glsl`,
  GBUFFER_FRAGMENT: `${BASES.shaders}/gbufferShader/gbufferFragment.glsl`,
  // Scene Depth
  SCENE_DEPTH_VERTEX: `${BASES.shaders}/sceneDepthShader/depthVertex.glsl`,
  SCENE_DEPTH_FRAGMENT: `${BASES.shaders}/sceneDepthShader/depthFragment.glsl`,
  // Shadow Map
  SHADOW_VERTEX: `${BASES.shaders}/shadowShader/shadowVertex.glsl`,
  SHADOW_FRAGMENT: `${BASES.shaders}/shadowShader/shadowFragment.glsl`,
  // Equirect To Cubemap
  EQUIRECT_TO_CUBEMAP_VERTEX: `${BASES.shaders}/IBLShader/equirectToCubemapShader/EquirectToCubemapVertex.glsl`,
  EQUIRECT_TO_CUBEMAP_FRAGMENT: `${BASES.shaders}/IBLShader/equirectToCubemapShader/EquirectToCubemapFragment.glsl`,
  // Irradiance
  IRRADIANCE_VERTEX: `${BASES.shaders}/IBLShader/irradianceShader/IrradianceVertex.glsl`,
  IRRADIANCE_FRAGMENT: `${BASES.shaders}/IBLShader/irradianceShader/IrradianceVertex.glsl`,
  // Skybox
  SKYBOX_VERTEX: urlJoin(BASES.shaders, '/skyboxShader/SkyboxVertex.vert'),
  SKYBOX_FRAGMENT: urlJoin(BASES.shaders, '/skyboxShader/SkyboxFragment.frag'),
  // SSR
  SSR_VERTEX: `${BASES.shaders}/ssrShader/ssrVertex.glsl`,
  SSR_FRAGMENT: `${BASES.shaders}/ssrShader/ssrFragment.glsl`,
  // Sine Wave
  SINE_WAVE_VERTEX: urlJoin(BASES.shaders, '/waterShader/SinWaveVertex.vert'),
  SINE_WAVE_FRAGMENT: urlJoin(BASES.shaders, '/waterShader/SinWaveFragment.frag'),
  // Gerstner Wave
  GERSTNER_WAVE_VERTEX: urlJoin(BASES.shaders, '/waterShader/GerstnerWaveVertex.vert'),
  GERSTNER_WAVE_FRAGMENT: urlJoin(BASES.shaders, '/waterShader/GerstnerWaveFragment.frag'),
  // FFT Ocean
  FFT_OCEAN_VERTEX: urlJoin(BASES.shaders, '/fftOceanShader/FFTOceanVertex.vert'),
  FFT_OCEAN_FRAGMENT: urlJoin(BASES.shaders, '/fftOceanShader/FFTOceanFragment.frag')
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

// // 预定义的 CubeMap 配置
// // export const CubeMapConfigs = {
// //   SKY_09: {
// //     basePath: TexturePaths.SKY_09_CUBEMAP,
// //     extension: FileExtensions.PNG
// //   } as CubeMapConfig
// // } as const

// // 着色器配置
// export const ShaderConfigs = {
//   SKYBOX: {
//     vertex: ShaderPaths.SKYBOX_VERTEX,
//     fragment: ShaderPaths.SKYBOX_FRAGMENT
//   }
// } as const

// // 使用示例
// export class ResourceManager {
//   // 获取 CubeMap 配置
//   // static getCubeMapConfig(type: keyof typeof CubeMapConfigs): CubeMapConfig {
//   //   return CubeMapConfigs[type]
//   // }

//   // 获取着色器配置
//   static getShaderConfig(type: keyof typeof ShaderConfigs) {
//     return ShaderConfigs[type]
//   }

//   // 构建完整的纹理路径
//   static buildTexturePath(basePath: string, filename: string, extension: FileExtensions): string {
//     return `${basePath}${filename}${extension}`
//   }
// }
