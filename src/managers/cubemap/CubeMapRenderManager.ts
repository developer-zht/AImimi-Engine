import { ShaderPaths } from '@/config/resourcePaths'
import { buildSkyboxMaterial } from '@/materials/SkyboxMaterial'
import { Mesh } from '@/objects/Mesh'
import { SkyboxMesh } from '@/objects/SkyboxMesh'
import { MeshRender } from '@/renderers/MeshRender'
import { WebGLRenderer } from '@/renderers/WebGLRenderer'
import { CubeMapRenderManagerParams, CubeMapType } from '@/types/CubeMapRender'
import { BaseMeshRenderManager } from '@/managers/baseRenderManager/BaseMeshRenderManager'

export class CubeMapRenderManager extends BaseMeshRenderManager {
  // private gl: WebGLRenderingContext
  // private meshRender: MeshRender
  private config: CubeMapRenderManagerParams
  private meshType: CubeMapType
  private renderType: CubeMapType
  private materialTexture: WebGLTexture

  constructor(gl: WebGLRenderingContext, config: CubeMapRenderManagerParams) {
    super(gl)
    // this.gl = gl
    this.config = config
    this.meshType = this.config.cubeMapType
    this.renderType = this.config.cubeMapType
    this.materialTexture = this.config.texture
  }

  // 初始化 Skybox Vertices
  protected createMesh(): Mesh {
    switch (this.meshType) {
      case CubeMapType.SKYBOX: {
        const skyboxMesh = new SkyboxMesh(this.config.transformation)
        return skyboxMesh
      }
    }
  }

  // 初始化 Skybox Material
  protected async createMaterial() {
    switch (this.renderType) {
      case CubeMapType.SKYBOX:
        return await buildSkyboxMaterial(
          this.gl,
          ShaderPaths.SKYBOX_VERTEX,
          ShaderPaths.SKYBOX_FRAGMENT,
          this.materialTexture
        )
    }
  }

  // 初始化 MeshRender
  async initMeshRender() {
    try {
      const mesh = this.createMesh()
      const material = await this.createMaterial()
      this.meshRender = new MeshRender(this.gl, mesh, material)

      console.log(`Water renderer initialized with type: ${this.config.cubeMapType}`)
    } catch (error) {
      console.error('Failed to initialize water renderer:', error)
      throw error
    }
  }

  // 站位函数
  update(time: number): Promise<void> {
    return
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
