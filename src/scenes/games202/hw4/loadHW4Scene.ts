import { loadGLTF } from '@/loaders/loadGLTF'
import { ForwardRenderPass } from '@/renderers/passes/forward/ForwardRenderPass'
import { MeshRenderer } from '@/renderers/MeshRenderer'
import { createMeshRendererFromGLTF } from '@/renderers/factories/meshRendererFromModel/fromGLTF/createMeshRendererFromGLTF'
import { loadOBJ } from '@/loaders/loadOBJ'
import { createMeshRendererFromOBJ } from '@/renderers/factories/meshRendererFromModel/fromOBJ/createMeshRendererFromOBJ'
import { LightSystem } from '@/lights/LightSystem'
import { Texture } from '@/textures/Texture'
import { loadImageAsync } from '@/loaders/loadImage'
import { CubeMapTexture } from '@/textures/CubeMapTexture'
import { loadCubeMapImages } from '@/loaders/loadCubeMapImages'
import { ResourceLoadError } from '@/errors/EngineError/ResourceError/ResourceLoadError'
import { SharedTextures } from './types/loadHW4Scene'
import { Transform } from '@/objects/utils/Transform'
import { CookTorranceMaterial } from '@/materials/pbr/CookTorranceMaterial'
import { KullaContyMaterial } from '@/materials/pbr/KullaContyMaterial'
import { SceneContext } from '@/scenes/types/SceneContext'
import { BALL_SCENE_CONFIG, ROUGHNESS_LEVELS } from './_config/ballSceneConfig'
import { createCubemapBackground } from '@/scenes/environment/background/createCubemapBackground'

export async function loadHW4Scene(ctx: SceneContext) {
  const { gl, camera, renderer, controls } = ctx

  const config = BALL_SCENE_CONFIG
  const { cameraConfig, modelConfigs, lightConfigs, lutPaths, envCubeMapImagesConfig } = config

  const funcName = '[loadHW4Scene]'

  // 相机
  camera.position.set(...cameraConfig.position)
  controls.target.set(...cameraConfig.target)

  //  光源
  const lightSystem = new LightSystem(gl)
  if (lightConfigs) {
    for (const lightConfig of lightConfigs) {
      await lightSystem.addLight(lightConfig.id, lightConfig.light)
    }
  }

  // 加载共享纹理资源
  if (!lutPaths.BALL_GGX_E_LUT || !lutPaths.BALL_GGX_Eavg_LUT || !envCubeMapImagesConfig)
    throw new ResourceLoadError(
      'image',
      'lutPaths.BALL_GGX_E_LUT | lutPaths.BALL_GGX_Eavg_LUT | environment.basePath'
    )

  const [ggxEImg, eavgImg, cubemapImgs] = await Promise.all([
    loadImageAsync(lutPaths.BALL_GGX_E_LUT),
    loadImageAsync(lutPaths.BALL_GGX_Eavg_LUT),
    loadCubeMapImages(envCubeMapImagesConfig)
  ])

  const brdfLutTex = new Texture(gl)
  brdfLutTex.createFromImage(ggxEImg)

  const eavgLutTex = new Texture(gl)
  eavgLutTex.createFromImage(eavgImg)

  const envCubemapTex = new CubeMapTexture(gl)
  envCubemapTex.createFromImages(cubemapImgs)

  // Albedo 贴图（Assignment4 的 ball.gltf 没有贴图，用 copper 色 1x1 纹理代替）
  const albedoTex = new Texture(gl)
  albedoTex.createFromColor([0.913, 0.522, 0.255], false) // copper 色（线性空间）

  const sharedTextures: SharedTextures = {
    albedoMap: albedoTex.glTextureOrThrow,
    brdfLutMap: brdfLutTex.glTextureOrThrow,
    eavgLutMap: eavgLutTex.glTextureOrThrow,
    envCubeTexture: envCubemapTex.glTextureOrThrow
  }

  const meshRenderers: MeshRenderer[] = []

  for (let i = 0; i < modelConfigs.length; i++) {
    const modelConfig = modelConfigs[i]
    if (!modelConfig) continue
    const rendererName = `${modelConfig.name.toUpperCase()}MeshRenderer`

    for (let col = 0; col < ROUGHNESS_LEVELS.length; col++) {
      let material
      if (i === 0) {
        material = new CookTorranceMaterial(
          `${funcName} CookTorranceMaterial<${rendererName}>`,
          sharedTextures.albedoMap,
          1.0,
          ROUGHNESS_LEVELS[col]!,
          sharedTextures.brdfLutMap,
          sharedTextures.envCubeTexture
        )
      } else if (i === 1) {
        material = new KullaContyMaterial(
          `${funcName} KullaContyMaterial<${rendererName}>`,
          sharedTextures.albedoMap,
          1.0,
          ROUGHNESS_LEVELS[col]!,
          sharedTextures.brdfLutMap,
          sharedTextures.eavgLutMap,
          sharedTextures.envCubeTexture
        )
      }

      if (modelConfig.format === 'gltf') {
        const meshDataArr = await loadGLTF(
          modelConfig.path,
          modelConfig.name,
          modelConfig.transforms![col]
        )

        for (const meshData of meshDataArr) {
          const meshRenderer = await createMeshRendererFromGLTF(gl, {
            data: meshData,
            vertShaderPath: modelConfig.vertShaderPath,
            fragShaderPath: modelConfig.fragShaderPath,
            rendererName: `${rendererName}#${i}`,
            material
          })
          meshRenderer.castShadow = false
          meshRenderer.receiveShadow = false
          meshRenderers.push(meshRenderer)
        }
      }

      if (modelConfig.format === 'obj') {
        const meshDataArr = await loadOBJ(
          modelConfig.path,
          modelConfig.name,
          modelConfig.transforms![col]
        )

        for (const meshData of meshDataArr) {
          const meshRenderer = await createMeshRendererFromOBJ(gl, {
            data: meshData,
            vertShaderPath: modelConfig.vertShaderPath,
            fragShaderPath: modelConfig.fragShaderPath,
            rendererName: `${rendererName}#${i}`,
            material
          })
          meshRenderer.castShadow = false
          meshRenderer.receiveShadow = false
          meshRenderers.push(meshRenderer)
        }
      }
    }
  }

  const cubeMapsize = 50
  const bgCubemapRenderer = await createCubemapBackground(gl, {
    basePath: envCubeMapImagesConfig.basePath,
    extension: envCubeMapImagesConfig.extension,
    cubeMapsize,
    faceKeys: envCubeMapImagesConfig.faceKeys,
    transform: new Transform([cubeMapsize * 0.5, 0, cubeMapsize * 0.7])
  })
  meshRenderers.push(bgCubemapRenderer)

  const forwardRenderPass = new ForwardRenderPass(lightSystem)
  for (const meshRenderer of meshRenderers) {
    forwardRenderPass.addTargetRenderer(meshRenderer)
  }
  renderer.addRenderPass(forwardRenderPass)

  // 返回清理函数，场景切换时调用
  return function disposeHW4Scene() {
    // RenderPass 的 dispose 由 renderer.clearRenderPasses() 统一调用
    // 这里只清理"场景独占的、Pass 不管的"资源
    brdfLutTex.dispose()
    eavgLutTex.dispose()
    envCubemapTex.dispose()
    albedoTex.dispose()
  }
}
