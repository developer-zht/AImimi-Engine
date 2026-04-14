// import './visualizers/createDirectionalLightVisualizer'
// import './visualizers/createPointLightVisualizer'

import { MeshRenderer } from '@/renderers/MeshRenderer'
import { ILight } from './types/light'
import { createLightVisualizer } from './visualizers/createLightVisualizer'
import { BaseRenderer } from '@/renderers/BaseRenderer'

import { IDirectionalLight } from './directionalLight/types/directionalLight'
import { IPointLight } from './pointLight/types/pointLight'
import { Uniforms, UniformType } from '@/materials/types/Material'
import { mat4 } from 'gl-matrix'
import { IShadowCaster } from '@/renderers/passes/shadow/types/shadow'

/**
 * 场景级光源管理系统
 *
 * 职责：
 * 1. 管理所有光源数据
 * 2. 每帧重新计算光源参数（VP 矩阵、方向等）
 * 3. 将光源 uniform 推送给所有需要光照的场景渲染器
 * 4. 管理 Shadow Map FBO
 *
 * 不负责：
 * - 光源可视化渲染（由 createLightVisualizer 工厂函数负责）
 * - 具体的渲染管线（由 WebGLRenderer 负责）
 */
export class LightSystem {
  private gl: WebGLRenderingContext

  // 场景中的光源视觉效果，不提供光源参数
  private visualizers: Map<string, MeshRenderer> = new Map()

  // 场景中的光源参数，不提供光源视觉效果
  private lights: Map<string, ILight> = new Map()

  // ============================================================
  //  Shadow 相关
  //  当前设计：仅支持单个 shadow caster light
  //  扩展多光源阴影时需要将以下三个成员改为 Map<string, ShadowEntry>
  // ============================================================
  // private shadowCasterLightId: string | null = null
  // private shadowMapFBO: ShadowMapFBO | null = null
  // private shadowPass: ShadowPass | null = null

  // applyStaticShadowUniforms：只在 addRenderer / addLight 时调用一次。
  // 如果 GUI 已经改了 uShadowMethod = 1，但之后新加了一个 renderer，这个 renderer 的 uShadowMethod 还是初始值 2。
  // 所以 static 函数需要用 this.defaultShadowMethod（GUI 修改时同步更新）。
  // public defaultShadowMethod: number = 2
  // public defaultFilterRadius: number = 10

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl
  }

  // ============================================================
  //  光源管理
  // ============================================================

  /** 添加光源 */
  async addLight(id: string, light: ILight): Promise<MeshRenderer> {
    if (this.lights.has(id)) {
      console.warn(`[LightSystem] Light "${id}" already exists, skipping`)
      return this.visualizers.get(id)!
    }

    this.lights.set(id, light)

    // 如果该光源能投射阴影，且 shadow pass 还未初始化
    // if (this.isShadowCaster(light) && light.castShadow && !this.shadowPass) {
    //   await this.initShadowPass(id, light)
    // }

    // 创建对应的 gizmo
    const visualizer = await createLightVisualizer(this.gl, light)
    this.visualizers.set(id, visualizer)

    return visualizer
  }

  /** 删除光源 */
  removeLight(id: string): MeshRenderer | undefined {
    // 清理 lights
    if (!this.lights.has(id)) {
      console.warn(`[LightSystem] Light "${id}" not found, skipping`)
      return undefined
    }

    this.lights.delete(id)

    // 如果删除的是投射阴影的光源，清理 shadow 资源
    // if (id === this.shadowCasterLightId) {
    //   this.disposeShadow()
    // }

    // 清理 gizmo
    const visualizer = this.visualizers.get(id)
    this.visualizers.delete(id)

    return visualizer
  }

  /** 获取指定光源 */
  getLight(id: string): ILight | undefined {
    return this.lights.get(id)
  }

  /**
   * 获取主方向光源（当前只支持单光源）
   * 未来多光源时改为循环
   */
  private getPrimaryLight(): ILight | null {
    for (const light of this.lights.values()) {
      if (light.type === 'directional') return light
    }
    return null
  }

  /**
   * 获取主投影光源（当前只支持单光源）
   * 未来多光源时改为循环
   */
  getPrimaryShadowCasterId(): string | null {
    for (const [id, light] of this.lights) {
      if (this.isShadowCaster(light) && light.castShadow) {
        return id
      }
    }
    return null
  }

  /**
   * 注入光照相关的 uniform 声明到 renderer 的 material 中（upsert）
   *
   * 注入内容：uLightPos, uLightDir, uLightRadiance
   * 初始值为占位（全零），由 applyPerFrameLightUniforms 每帧覆盖
   *
   * 在 WebGLRenderer.addRenderer 时自动调用，
   * 使得 scene config 中无需手动声明光照 uniform
   */
  injectLightUniforms(renderer: BaseRenderer): void {
    renderer.updateMaterialUniforms({
      uLightPos: { type: UniformType.THREE_FV, value: [0, 0, 0] },
      uLightDir: { type: UniformType.THREE_FV, value: [0, 0, 0] },
      uLightRadiance: { type: UniformType.THREE_FV, value: [0, 0, 0] }
    })
  }

  /**
   * 注入阴影相关的 uniform 声明到 renderer 的 material 中（upsert）
   *
   * 注入内容：uUseDepthTexture, uShadowMap, uLightVP
   * 仅对 receiveShadow === true 的 renderer 调用
   *
   * 在 WebGLRenderer.addRenderer 或 addLight 时调用
   */
  injectShadowUniforms(renderer: BaseRenderer) {
    renderer.updateMaterialUniforms({
      uUseDepthTexture: {
        type: UniformType.ONE_I,
        value: 0
      },
      uShadowMap: { type: UniformType.TEXTURE_2D, value: null },
      uLightVP: { type: UniformType.MATRIX_4FV, value: mat4.create() },
      // 新增：shadow 参数
      uShadowMapSize: { type: UniformType.ONE_F, value: 2048 },
      uFrustumSize: { type: UniformType.ONE_F, value: 200 },
      uLightNearPlane: { type: UniformType.ONE_F, value: 0.1 },
      uLightWorldSize: { type: UniformType.ONE_F, value: 5.0 },
      uFilterRadius: { type: UniformType.ONE_F, value: 10.0 },
      uShadowMethod: { type: UniformType.ONE_I, value: 2 } // 默认 PCSS
    })
  }

  // ============================================================
  //  Shadow initialize & dispose
  // ============================================================
  // =============== 单光源 ===============
  // private async initShadowPass(id: string, light: IShadowCaster): Promise<void> {
  //   const gl = this.gl
  //   const resolution = light.shadowResolution

  //   // 1. ShadowMapFBO 先创建（内部检测扩展）
  //   this.shadowMapFBO = new ShadowMapFBO(gl, resolution)

  //   // 2. ShadowPass 从 ShadowMapFBO 获取 useDepthTexture
  //   this.shadowPass = await ShadowPass.create(gl, this.shadowMapFBO)

  //   // 3. 记录关联的 light id
  //   this.shadowCasterLightId = id
  // }

  // private disposeShadow(): void {
  //   this.shadowPass?.dispose()
  //   this.shadowMapFBO?.dispose()
  //   this.shadowPass = null
  //   this.shadowMapFBO = null
  //   this.shadowCasterLightId = null
  // }

  // ============================================================
  //  每帧：Shadow Pass
  // ============================================================

  /**
   * 执行 shadow pass（在 main pass 之前调用）
   * 从场景中
   * @param shadowCasters - castShadow === true 的渲染器（由调用方过滤）
   */
  // =============== 单光源 ===============
  // executeShadowPass(shadowCasters: BaseRenderer[]) {
  //   if (!this.shadowPass || !this.shadowCasterLightId) return

  //   const light = this.lights.get(this.shadowCasterLightId)
  //   if (!light) return

  //   // 保存当前 viewport 状态
  //   const savedViewport = this.gl.getParameter(this.gl.VIEWPORT) as Int32Array
  //   const vpX = savedViewport[0] ?? 0
  //   const vpY = savedViewport[1] ?? 0
  //   const vpW = savedViewport[2] ?? this.gl.canvas.width
  //   const vpH = savedViewport[3] ?? this.gl.canvas.height

  //   switch (light.type) {
  //     case 'directional':
  //       this.shadowPass.excuteDirectionalLight(light as IDirectionalLight, shadowCasters)
  //       break
  //     case 'point':
  //       // TODO: this.shadowPass.executePointLight(light as IPointLight, shadowCasters)
  //       break
  //     case 'spot':
  //       // TODO: this.shadowPass.executeSpotLight(light as IPointLight, shadowCasters)
  //       break
  //     default:
  //       console.warn(`[LightSystem] Shadow not supported for light type: ${light.type}`)
  //   }

  //   // 恢复 viewport（framebuffer 的解绑由 ShadowPass 内部的 unbind 负责）
  //   this.gl.viewport(vpX, vpY, vpW, vpH)
  // }

  // ============================================================
  //  初始化：推送光源参数
  // ============================================================

  /**
   * 初始化时设置一次（shadow pass 创建后调用）
   * 只对 receiveShadow 的 renderer 调用
   */
  // applyStaticShadowUniforms(
  //   renderer: BaseRenderer,
  //   defaults: ShadowRenderDefaults = DEFAULT_SHADOW_RENDER
  // ): void {
  //   if (!this.shadowMapFBO || !this.shadowCasterLightId) return // 只检查自己内部成员的状态

  //   const shadowLight = this.lights.get(this.shadowCasterLightId)
  //   if (!shadowLight || !this.isShadowCaster(shadowLight)) return

  //   const uniforms: Uniforms = {}

  //   const type = shadowLight.type

  //   switch (type) {
  //     case 'directional': {
  //       const light = shadowLight as DirectionalLight
  //       const config = light.shadowConfig

  //       // 生命周期内不变
  //       uniforms['uUseDepthTexture'] = {
  //         type: UniformType.ONE_I,
  //         value: this.shadowMapFBO.useDepthTexture ? 1 : 0
  //       }
  //       uniforms['uShadowMapSize'] = {
  //         type: UniformType.ONE_F,
  //         value: light.shadowResolution
  //       }
  //       uniforms['uFrustumSize'] = {
  //         type: UniformType.ONE_F,
  //         value: config.orthoSize * 2
  //       }
  //       uniforms['uLightNearPlane'] = {
  //         type: UniformType.ONE_F,
  //         value: config.near
  //       }
  //       // 光源属性，GUI 可调
  //       uniforms['uLightWorldSize'] = {
  //         type: UniformType.ONE_F,
  //         value: light.worldSize
  //       }
  //       // 用户偏好（初始默认值），GUI 可调
  //       uniforms['uShadowMethod'] = {
  //         type: UniformType.ONE_I,
  //         value: defaults.method
  //       }
  //       uniforms['uFilterRadius'] = {
  //         type: UniformType.ONE_F,
  //         value: defaults.filterRadius
  //       }

  //       break
  //     }
  //     case 'point': {
  //       // TODO: 点光源用 cube shadow map
  //       // const pointLight = shadowLight as IPointLight
  //       // lightUniforms['uShadowCubeMap'] = ...
  //       // lightUniforms['uLightCubeVPs'] = pointLight.getCubeViewProjectionMatrices()
  //       break
  //     }
  //     case 'spot': {
  //       // TODO: 点光源用 cube shadow map
  //       break
  //     }
  //     default: {
  //       console.warn(`[LightSystem] Shadow not implemented for light type: ${type}`)
  //     }
  //   }

  //   renderer.updateMaterialUniforms(uniforms)
  // }

  // ============================================================
  //  每帧：推送光源参数给场景
  // ============================================================

  /**
   * 推送光照参数到单个渲染器（每帧调用）
   *
   * 推送内容：uLightRadiance, uLightPos, uLightDir 等
   * 不包含阴影相关 uniform（由 applyPerFrameShadowUniforms 负责）
   */
  applyPerFrameLightUniforms(renderer: BaseRenderer) {
    const primaryLight = this.getPrimaryLight()
    if (!primaryLight) {
      // console.debug('[LightSystem] No primary light found, skipping')
      return
    }

    const uniforms: Uniforms = {
      uLightRadiance: { type: UniformType.THREE_FV, value: primaryLight.radiance }
    }

    switch (primaryLight.type) {
      case 'directional':
        {
          const light = primaryLight as IDirectionalLight
          uniforms['uLightDir'] = { type: UniformType.THREE_FV, value: light.shadingDirection }
          uniforms['uLightPos'] = { type: UniformType.THREE_FV, value: light.position }
        }
        break
      case 'point': {
        // TODO: 点光源参数
        const light = primaryLight as IPointLight
        uniforms['uLightPos'] = { type: UniformType.THREE_FV, value: light.position }
        break
      }
      case 'spot': {
        break
      }
      default:
        console.warn(`[LightSystem] Unsupported light type for uniform push: ${primaryLight.type}`)
    }

    renderer.updateMaterialUniforms(uniforms)
  }

  /**
   * 推送阴影参数到单个渲染器（每帧调用）
   *
   * 推送内容：uLightVP, uShadowMap
   * 仅对 receiveShadow === true 的 renderer 调用（由外部过滤）
   *
   * 静态阴影参数（uUseDepthTexture）由 applyStaticShadowUniforms 在 addLight 时一次性设置
   */
  // applyPerFrameShadowUniforms(renderer: BaseRenderer): void {
  //   if (!this.shadowMapFBO || !this.shadowCasterLightId) return

  //   const shadowLight = this.lights.get(this.shadowCasterLightId)
  //   if (!shadowLight) return

  //   const uniforms: Uniforms = {}

  //   const type = shadowLight.type
  //   switch (type) {
  //     case 'directional': {
  //       const light = shadowLight as DirectionalLight
  //       const config = light.shadowConfig

  //       // 在 shadowMapFBO 的声明周期中都不会改变的 uniform，放到 applyStaticShadowUniforms 中实现
  //       // lightUniforms['uUseDepthTexture'] = this.shadowMapFBO.useDepthTexture

  //       uniforms['uShadowMap'] = {
  //         type: UniformType.TEXTURE_2D,
  //         value: this.shadowMapFBO.getShadowMapTexture()
  //       }
  //       uniforms['uLightVP'] = {
  //         type: UniformType.MATRIX_4FV,
  //         value: light.getViewProjectionMatrix()
  //       }
  //       uniforms['uShadowMapSize'] = {
  //         type: UniformType.ONE_F,
  //         value: light.shadowResolution
  //       }
  //       uniforms['uFrustumSize'] = {
  //         type: UniformType.ONE_F,
  //         value: config.orthoSize * 2
  //       }
  //       uniforms['uLightNearPlane'] = {
  //         type: UniformType.ONE_F,
  //         value: config.near
  //       }
  //       uniforms['uLightWorldSize'] = {
  //         type: UniformType.ONE_F,
  //         value: light.worldSize
  //       }
  //       break
  //     }
  //     case 'point': {
  //       // TODO: 点光源用 cube shadow map
  //       // const pointLight = shadowLight as IPointLight
  //       // lightUniforms['uShadowCubeMap'] = ...
  //       // lightUniforms['uLightCubeVPs'] = pointLight.getCubeViewProjectionMatrices()
  //       break
  //     }
  //     case 'spot': {
  //       // TODO: 点光源用 cube shadow map
  //       break
  //     }
  //     default: {
  //       console.warn(`[LightSystem] Shadow not implemented for light type: ${type}`)
  //     }
  //   }

  //   renderer.updateMaterialUniforms(uniforms)
  // }

  // ============================================================
  //  每帧：推送“假”光源参数（暂时被舍弃）
  // ============================================================

  // updateVisualizers() {
  //   for (const [id, light] of this.lights) {
  //     const viz = this.visualizers.get(id)
  //     if (!viz) continue

  //     // visualizer 是一个小方块 gizmo，它的 material 只有 uLightColor 这一个 uniform
  //     // 它不接收光照、不投射阴影，不需要 uLightDir、uLightPos 这些 uniform。

  //     // 1. 位置：通过 mesh 的 transform 同步（attribute 层面）
  //     viz.mesh.setTranslation(light.position[0], light.position[1], light.position[2])

  //     // 2. 颜色：通过 material uniform 同步
  //     viz.updateMaterialUniforms({
  //       uLightColor: light.radiance
  //     })
  //   }
  // }

  // ============================================================
  //  辅助函数
  // ============================================================

  /**
   * 判断 light 是否具有投射阴影的能力
   *
   * 实现：
   * 类型守卫：是否实现了 IShadowCaster
   */
  isShadowCaster(light: ILight): light is ILight & IShadowCaster {
    return 'castShadow' in light && 'shadowResolution' in light
  }

  // ============================================================
  //  Getter
  // ============================================================

  // getShadowPass(): ShadowPass | null {
  //   return this.shadowPass
  // }

  getVisualizer(id: string): MeshRenderer | undefined {
    return this.visualizers.get(id)
  }

  getVisualizers(): Map<string, MeshRenderer> {
    return this.visualizers
  }

  // ============================================================
  //  清理
  // ============================================================
  dispose(): void {
    // 1. 释放 Shadow 相关资源
    // this.disposeShadow()

    // 1. 释放 visualizers
    for (const visualizer of this.visualizers.values()) {
      visualizer.dispose()
    }

    // 2. 清空引用
    this.lights.clear()
    this.visualizers.clear()
  }
}
