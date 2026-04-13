import { LineRender } from '@/renderers/LineRender'
import { MeshRender } from '@/renderers/MeshRender'
import { PerspectiveCamera } from 'three'

import type {
  LightObj,
  UpdatedParamters,
  UpdatedTimeParameter
} from '@/renderers/types/WebGLRenderer-deprecated'
import type { UpdatedLightParamters } from '@/types/light'
import { FFTOceanRenderManager } from '@/managers/fftOcean/FFTOceanRenderManager'
import { BaseRenderManager } from '@/managers/BaseRenderManager-deprecated/BaseRenderManager'

export interface DrawControlParams {
  globalTextureNum: number // TEXTUREi 计数器
}

export class WebGLRenderer {
  public gl: WebGLRenderingContext
  public gl_draw_buffers: WEBGL_draw_buffers
  public camera: PerspectiveCamera

  public lights: LightObj[] = []
  private lineRenders: LineRender[] = []
  private meshRenders: MeshRender[] = []
  private shadowMesheRenders: MeshRender[] = []
  private bufferMesheRenders: MeshRender[] = []

  private axisLineRender: LineRender

  private startTime: number

  private drawControlParams: DrawControlParams = {
    // TEXTUREi 计数器
    globalTextureNum: 0
  }

  private managers: Record<string, BaseRenderManager>

  constructor(
    gl: WebGLRenderingContext,
    gl_draw_buffers: WEBGL_draw_buffers,
    camera: PerspectiveCamera
  ) {
    this.gl = gl
    this.gl_draw_buffers = gl_draw_buffers
    this.camera = camera
    this.managers = {}
    this.startTime = Date.now()
  }

  addLight(light: LightObj['entity']) {
    this.lights.push({
      entity: light,
      meshRender: new MeshRender(this.gl, light.mesh, light.material)
    })
  }

  addLineRender(lineRender: LineRender) {
    this.lineRenders.push(lineRender)
  }

  deleteLineRender(lineRender: LineRender) {
    this.lineRenders.splice(this.lineRenders.indexOf(lineRender))
  }

  addMeshRender(meshRender: MeshRender) {
    this.meshRenders.push(meshRender)
  }

  deleteMeshRender(meshRender: MeshRender) {
    this.meshRenders.splice(this.meshRenders.indexOf(meshRender))
  }

  addShadowMeshRender(meshRender: MeshRender) {
    this.shadowMesheRenders.push(meshRender)
  }

  addBufferMeshRender(meshRender: MeshRender) {
    this.bufferMesheRenders.push(meshRender)
  }

  setAxisLineRender(axisLineRender: LineRender) {
    this.axisLineRender = axisLineRender
  }

  addToManagers<T extends BaseRenderManager>(manager: T, name: string) {
    if (Object.keys(this.managers).includes(name)) {
      console.log(`⚠️ A manager named ${name} already exists! Please delete the old one first.`)
      console.log(`❌ Adding ${name} failed!`)
      return
    }
    this.managers[name] = manager
  }

  getManager<T extends BaseRenderManager>(name: string): T {
    const manager = this.managers[name]
    if (!manager) {
      throw new Error(`❌ No ${name} in Managers!`)
    }
    // 添加运行时类型检查（如果可能）
    if (!(manager instanceof Object.getPrototypeOf(manager).constructor)) {
      throw new TypeError(`Type mismatch for ${name}`)
    }
    return manager as T
  }

  deleteManager(name: string) {
    if (!Object.keys(this.managers).includes(name)) {
      console.log(`❌ No manager named ${name}.`)
      return
    }
    Reflect.deleteProperty(this.managers, name)
  }

  render() {
    console.assert(this.lights.length != 0, 'No light')
    console.assert(this.lights.length == 1, 'Multiple lights')
    const light = this.lights[0]

    const gl = this.gl
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clearDepth(1.0)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    // TEXTUREi 的默认偏移量为 0
    this.drawControlParams.globalTextureNum = 0

    /**
     * 更新参数
     * Update light parameters
     * Update time
     * 合并参数
     */
    // 每一帧光源的位置、方向可能会变化，需要重新计算
    const lightVP = light.entity.CalcDirectionalLightVP()
    const lightDir = light.entity.CalcDirectionalShadingDirection()
    const updatedLightParamters: UpdatedLightParamters = {
      uLightVP: lightVP,
      uLightDir: lightDir
    }

    // 动画需要时间更新
    const updatedTimeParameter: UpdatedTimeParameter = {
      uTime: (Date.now() - this.startTime) / 1000
    }
    // 合并参数
    const updatedParameters: UpdatedParamters = {
      ...updatedLightParamters,
      ...updatedTimeParameter
    }

    // Draw light
    light.meshRender.mesh.transform.translate = light.entity.lightPos
    light.meshRender.draw(
      this.camera,
      this.gl_draw_buffers,
      null,
      updatedParameters,
      this.drawControlParams
    )
    // console.log(light.meshRender)

    // Shadow pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, light.entity.fbo)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    for (let i = 0; i < this.shadowMesheRenders.length; i++) {
      //   console.log(this.shadowMeshes[i])
      this.shadowMesheRenders[i].draw(
        this.camera,
        this.gl_draw_buffers,
        light.entity.fbo,
        updatedParameters,
        this.drawControlParams
      )
      // this.shadowMeshes[i].draw(this.camera);
    }

    // Buffer pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.camera.fbo)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    for (let i = 0; i < this.bufferMesheRenders.length; i++) {
      this.bufferMesheRenders[i].draw(
        this.camera,
        this.gl_draw_buffers,
        this.camera.fbo,
        updatedParameters,
        this.drawControlParams
      )
      // this.bufferMeshes[i].draw(this.camera);
    }

    // FFT Ocean Spatial Pass
    const fftOceanRenderManager = this.getManager<FFTOceanRenderManager>('fftOceanRenderManager')
    if (fftOceanRenderManager) {
      fftOceanRenderManager.update(updatedTimeParameter.uTime)
    }
    // Camera pass
    // 坐标轴HUD渲染 - 在所有其他渲染完成后
    for (let i = 0; i < this.lineRenders.length; i++) {
      this.lineRenders[i].draw(
        this.camera,
        this.gl_draw_buffers,
        null,
        updatedParameters,
        this.drawControlParams
      )
    }
    for (let i = 0; i < this.meshRenders.length; i++) {
      this.meshRenders[i].draw(
        this.camera,
        this.gl_draw_buffers,
        null,
        updatedParameters,
        this.drawControlParams
      )
    }
    if (this.axisLineRender) {
      // 假设您有一个专门的轴线渲染器
      this.axisLineRender.renderAsHUD(
        this.camera,
        this.drawControlParams,
        { x: 0.05, y: 0.05 }, // 左下角，距离边缘5%
        120 // HUD区域120x120像素
      )
    }
  }
}
