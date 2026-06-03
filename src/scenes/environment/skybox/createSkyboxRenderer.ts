import { SkyboxMesh } from '@/objects/SkyboxMesh'
import { SkyboxConfig } from './types/SkyboxConfig'
import { SkyboxMaterial } from '@/materials/environment/SkyboxMaterial'
import { loadHDR } from '@/loaders/loadHDR'
import { loadCubeMapImages } from '@/loaders/loadCubeMapImages'
import { assertNever } from '@/errors/helper/helpers'
import { Shader } from '@/shaders/Shader'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { MeshRenderer } from '@/renderers/MeshRenderer'
import { SkyboxMaterialConfig } from '@/materials/environment/types/SkyboxMaterial'
import { loadCubemapFromHDR } from '@/textures/cubemap/loaders/loadCubemapFromHDR'
import { loadCubemapFromImages } from '@/textures/cubemap/loaders/loadCubemapFromImages'

export interface SkyboxRendererResult {
  renderer: MeshRenderer
  /** 原始 cubemap（HDR 是线性、LDR 是 sRGB 编码字节） */
  cubemap: WebGLTexture
  /** 该 cubemap 在 GPU 里是不是 sRGB 编码 */
  isSRGB: boolean
}

export async function createSkyboxRenderer(
  gl: WebGLRenderingContext,
  config: SkyboxConfig
): Promise<SkyboxRendererResult> {
  const ctx = '[createSkyboxRenderer]'
  const rendererName = 'SkyboxRenderer'

  // ---- 1. Mesh：单位立方体 ----
  const mesh = new SkyboxMesh(gl, `${ctx} SkyboxMesh<${rendererName}>`)

  // ---- 2. 根据 extension 判断加载方式 ----
  const basePath = config.basePath
  const extension = config.extension
  const defaultFaceKeys = ['px', 'nx', 'py', 'ny', 'pz', 'nz']
  const faceKeys = config.faceKeys ?? defaultFaceKeys

  let cubemap: WebGLTexture
  let isSRGB: boolean

  if (extension === '.exr' || extension === '.hdr') {
    // HDR 路径：加载 equirectangular HDR → 转换为 cubemap
    // 使用 equirectToCubemap shader
    const data = await loadHDR({ basePath, extension: extension === '.exr' ? '.exr' : '.hdr' })
    cubemap = await loadCubemapFromHDR(gl, data, {
      resolution: config.resolution,
      flipY: config.flipY ?? false,
      rotationY: config.rotationY ?? 0
    })
    isSRGB = false
  } else if (extension === '.jpg' || extension === '.png') {
    // LDR 路径：直接加载 6 张图片 → 创建 cubemap texture
    const images = await loadCubeMapImages({ basePath, extension, faceKeys })
    cubemap = loadCubemapFromImages(gl, images)
    isSRGB = true
  } else {
    assertNever(extension)
  }

  // ---- 3. Material ----
  const materialConfig: SkyboxMaterialConfig = {
    skyboxMap: cubemap!,
    isHDR: !isSRGB! ? 1 : 0,
    exposure: config.exposure ?? 1.0
  }
  const material = new SkyboxMaterial(`${ctx} SkyboxMaterial<${rendererName}>`, materialConfig)
  // material.setTexUniform(SKYBOX_UNIFORM.SKYBOX_MAP, glTexture)

  // ---- 4. Shader（两种模式用同一套 skybox shader） ----
  const shader = await Shader.createShader(
    gl,
    ShaderPaths.SKYBOX_VERTEX,
    ShaderPaths.SKYBOX_FRAGMENT
  )

  // ---- 4. MeshRenderer ----
  const meshRenderer = new MeshRenderer(gl, mesh, material, shader, `${ctx} ${rendererName}`)

  // 天空盒不参与阴影
  meshRenderer.receiveShadow = false
  meshRenderer.castShadow = false

  return { renderer: meshRenderer, cubemap: cubemap!, isSRGB: isSRGB! }
}
