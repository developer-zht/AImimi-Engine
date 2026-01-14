import urlJoin from 'url-join'

/**
 * 资源路径配置
 *
 * 使用环境变量支持多环境部署：
 * - 开发环境：直接访问源文件
 * - 生产环境：访问构建后文件
 */

// ========== 基础路径 ==========

/**
 * 应用基础路径
 * 来源：vite.config.ts 的 base 配置
 */
export const BASE_URL = import.meta.env.BASE_URL

/**
 * 着色器基础路径
 */
export const SHADER_BASE = urlJoin(BASE_URL, import.meta.env.VITE_SHADER_BASE || '/shaders')

/**
 * 纹理基础路径
 */
export const TEXTURE_BASE = urlJoin(
  BASE_URL,
  import.meta.env.VITE_TEXTURE_BASE || '/assets/textures'
)

/**
 * 模型基础路径
 */
// export const MODEL_BASE = urlJoin(BASE_URL, import.meta.env.VITE_MODEL_BASE || '/assets/models')

/**
 * 配置文件基础路径
 */
// export const CONFIG_BASE = urlJoin(BASE_URL, import.meta.env.VITE_CONFIG_BASE || '/configs')

const BASES = {
  shaders: urlJoin(import.meta.env.BASE_URL, import.meta.env.VITE_SHADER_BASE),
  textures: urlJoin(import.meta.env.BASE_URL, import.meta.env.VITE_TEXTURE_BASE)
}

// ========== 纹理路径 ==========

// FIXME: 未来使用的代码
// export const TexturePaths = {
//   // 天空盒
//   Skyboxes: {
//     SKY_09: urlJoin(TEXTURE_BASE, '/skyboxes/sky_09_cubemap/'),
//     SKY_18: urlJoin(TEXTURE_BASE, '/skyboxes/sky_18_cubemap/'),
//     SKY_SUNSET: urlJoin(TEXTURE_BASE, '/skyboxes/sky_sunset/')
//   },

//   // 环境贴图
//   Environment: {
//     QWANTANI_MOONRISE_EXR: urlJoin(
//       TEXTURE_BASE,
//       '/environment/skies/qwantani_moonrise_puresky_2k/puresky.exr'
//     ),
//     QWANTANI_MOONRISE_HDR: urlJoin(
//       TEXTURE_BASE,
//       '/environment/skies/qwantani_moonrise_puresky_2k/puresky.hdr'
//     ),
//     EVENING_SKY_EXR: urlJoin(
//       TEXTURE_BASE,
//       '/environment/skies/EveningSkyHDRI039B/EveningSkyHDRI039B_2K-HDR.exr'
//     )
//   }
// }

// 纹理资源路径配置
export const TexturePaths = {
  // 天空盒
  SKY_09_CUBEMAP: urlJoin(BASES.textures, '/skyboxes/sky_09_cubemap/'),
  SKY_18_CUBEMAP: urlJoin(BASES.textures, '/skyboxes/sky_18_cubemap/'),
  SKY_SUNSET: urlJoin(BASES.textures, '/skyboxes/sky_sunset/'),
  QWANTANI_MOONRISE_PURESKY_2K_EXR: urlJoin(
    BASES.textures,
    '/environment/skies/qwantani_moonrise_puresky_2k/puresky.exr'
  ),
  QWANTANI_MOONRISE_PURESKY_2K_HDR: urlJoin(
    BASES.textures,
    '/environment/skies/qwantani_moonrise_puresky_2k/puresky.hdr'
  ),
  EVENING_SKY_HDRI039B_EXR: urlJoin(
    BASES.textures,
    '/environment/skies/EveningSkyHDRI039B/EveningSkyHDRI039B_2K-HDR.exr'
  )
}

// ========== 着色器路径 ==========

// FIXME: 未来使用的代码
// export const ShaderPaths = {
//   // 坐标轴
//   Axis: {
//     VERTEX: urlJoin(SHADER_BASE, '/axisShader/AxisVertex.vert'),
//     FRAGMENT: urlJoin(SHADER_BASE, '/axisShader/AxisFragment.frag')
//   },

//   // 直接光
//   DirectLight: {
//     VERTEX: urlJoin(SHADER_BASE, '/directLightShader/directLightVertex.vert'),
//     FRAGMENT: urlJoin(SHADER_BASE, '/directLightShader/directLightFragment.frag')
//   },

//   // Skybox
//   Skybox: {
//     VERTEX: urlJoin(SHADER_BASE, '/skyboxShader/SkyboxVertex.vert'),
//     FRAGMENT: urlJoin(SHADER_BASE, '/skyboxShader/SkyboxFragment.frag')
//   },

//   // FFT Ocean
//   FFTOcean: {
//     VERTEX: urlJoin(SHADER_BASE, '/fftOceanShader/FFTOceanVertex.vert'),
//     FRAGMENT: urlJoin(SHADER_BASE, '/fftOceanShader/FFTOceanFragment.frag')
//   }
// }

// Shader 路径配置
export const ShaderPaths = {
  // Axis
  AXIS_VERTEX: urlJoin(BASES.shaders, '/axisShader/AxisVertex.vert'),
  AXIS_FRAGMENT: urlJoin(BASES.shaders, '/axisShader/AxisFragment.frag'),
  // Direct Light
  DIRECT_LIGHT_VERTEXT: `${BASES.shaders}/directLightShader/directLightVertex.vert`,
  DIRECT_LIGHT_FRAGMENT: `${BASES.shaders}/directLightShader/directLightFragment.frag`,
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
  SHADOW_VERTEX: `${BASES.shaders}/shadowShader/shadowVertex.vert`,
  SHADOW_FRAGMENT: `${BASES.shaders}/shadowShader/shadowFragment.frag`,
  // Equirect To Cubemap
  // EQUIRECT_TO_CUBEMAP_VERTEX: `${BASES.shaders}/IBLShader/equirectToCubemapShader/EquirectToCubemapVertex.glsl`,
  // EQUIRECT_TO_CUBEMAP_FRAGMENT: `${BASES.shaders}/IBLShader/equirectToCubemapShader/EquirectToCubemapFragment.glsl`,
  EQUIRECT_TO_CUBEMAP_VERTEX: urlJoin(
    BASES.shaders,
    'IBLShader/equirectToCubemapShader/EquirectToCubemapVertex.vert'
  ),
  EQUIRECT_TO_CUBEMAP_FRAGMENT: urlJoin(
    BASES.shaders,
    'IBLShader/equirectToCubemapShader/EquirectToCubemapFragment.frag'
  ),
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
  SINE_WAVE_VERTEX: urlJoin(BASES.shaders, '/sinWaveShader/SinWaveVertex.vert'),
  SINE_WAVE_FRAGMENT: urlJoin(BASES.shaders, '/sinWaveShader/SinWaveFragment.frag'),
  // Gerstner Wave
  GERSTNER_WAVE_VERTEX: urlJoin(BASES.shaders, '/gerstnerWaveShader/GerstnerWaveVertex.vert'),
  GERSTNER_WAVE_FRAGMENT: urlJoin(BASES.shaders, '/gerstnerWaveShader/GerstnerWaveFragment.frag'),
  // FFT Ocean
  FFT_OCEAN_VERTEX: urlJoin(BASES.shaders, '/fftOceanShader/FFTOceanVertex.vert'),
  FFT_OCEAN_FRAGMENT: urlJoin(BASES.shaders, '/fftOceanShader/FFTOceanFragment.frag'),
  FFT_STOCKHAM_VERTEX: urlJoin(BASES.shaders, '/fftShader/FFTStockham.vert'),
  FFT_STOCKHAM_FRAGMENT: urlJoin(BASES.shaders, '/fftShader/FFTStockham.frag'),
  FFT_STOCKHAM_2D_FRAGMENT: urlJoin(BASES.shaders, '/fftShader/FFTStockham2D.frag')
}

// 文件扩展名配置
export enum ResourceFileExtensions {
  PNG = '.png',
  JPG = '.jpg',
  WEBP = '.webp',
  HDR = '.hdr',
  GLSL = '.glsl',
  OBJ = '.obj',
  MTL = '.mtl'
}
