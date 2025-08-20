import { buildSkyboxMaterial } from '@/materials/SkyboxMaterial'
import { Mesh } from '@/objects/Mesh'
import { SkyboxMesh } from '@/objects/SkyboxMesh'
import { MeshRender } from '@/renderers/MeshRender'
import { WebGLRenderer } from '@/renderers/WebGLRenderer'
import { TransformationParams } from '@/types/transformation'

export enum CubeMapType {
  SKYBOX = 'skybox'
}

export interface CubeMapRenderManagerParams {
  // 几何参数
  transformation: TransformationParams

  // 网格类型 / 渲染类型
  cubeMapType: CubeMapType
}

export class CubeMapRenderManager {
  private gl: WebGLRenderingContext
  private config: CubeMapRenderManagerParams
  private meshRender: MeshRender

  constructor(gl: WebGLRenderingContext, config: CubeMapRenderManagerParams) {
    this.gl = gl
    this.config = config
  }

  // 初始化 Skybox Vertices
  private createCubeMapMesh(meshType: CubeMapRenderManagerParams['cubeMapType']): Mesh {
    switch (meshType) {
      case CubeMapType.SKYBOX:
        const skyboxMesh = new SkyboxMesh(this.config.transformation)
        return skyboxMesh
    }
  }

  // 初始化 Skybox Material
  private async createCubeMapMaterial(renderType: CubeMapRenderManagerParams['cubeMapType']) {
    switch (renderType) {
      case CubeMapType.SKYBOX:
        return await buildSkyboxMaterial(
          this.gl,
          'src/shaders/skyboxShader/SkyboxVertex.glsl',
          'src/shaders/skyboxShader/SkyboxFragment.glsl'
        )
    }
  }

  // 初始化 MeshRender
  async initMeshRender() {
    try {
      const mesh = this.createCubeMapMesh(this.config.cubeMapType)
      const material = await this.createCubeMapMaterial(this.config.cubeMapType)
      this.meshRender = new MeshRender(this.gl, mesh, material)

      console.log(`Water renderer initialized with type: ${this.config.cubeMapType}`)
    } catch (error) {
      console.error('Failed to initialize water renderer:', error)
      throw error
    }
  }

  // 获取当前的MeshRender对象
  getMeshRender(): MeshRender | null {
    return this.meshRender
  }
}

export async function loadCubeMap(renderer: WebGLRenderer, config: CubeMapRenderManagerParams) {
  const cubeMapRenderManager = new CubeMapRenderManager(renderer.gl, config)
  await cubeMapRenderManager.initMeshRender()

  // 将MeshRender添加到WebGLRenderer中
  renderer.addMeshRender(cubeMapRenderManager.getMeshRender())
}
