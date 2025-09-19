import urlJoin from 'url-join'

// 基础路径
const BASES = {
  shaders: urlJoin(import.meta.env.BASE_URL, import.meta.env.VITE_SHADER_BASE),
  textures: urlJoin(import.meta.env.BASE_URL, import.meta.env.VITE_TEXTURE_BASE)
}

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
  SINE_WAVE_VERTEX: urlJoin(BASES.shaders, '/sinWaveShader/SinWaveVertex.vert'),
  SINE_WAVE_FRAGMENT: urlJoin(BASES.shaders, '/sinWaveShader/SinWaveFragment.frag'),
  // Gerstner Wave
  GERSTNER_WAVE_VERTEX: urlJoin(BASES.shaders, '/gerstnerWaveShader/GerstnerWaveVertex.vert'),
  GERSTNER_WAVE_FRAGMENT: urlJoin(BASES.shaders, '/gerstnerWaveShader/GerstnerWaveFragment.frag'),
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
