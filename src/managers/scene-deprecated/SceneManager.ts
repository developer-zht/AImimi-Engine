/**
 * SceneManager - 场景管理器示例
 *
 * @remarks
 *  主要功能：
 * 1. 从 JSON 配置加载场景
 * 2. 动态切换场景
 * 3. 资源懒加载
 * 4. 场景状态管理
 *
 * @example
 * 在 Engine 中集成 SceneManager：
 *
 * ```typescript
 * // src/engine.ts
 * export class Engine {
 *   private sceneManager: SceneManager
 *
 *   async init() {
 *     // ...现有初始化代码
 *
 *     // 初始化场景管理器
 *     this.sceneManager = new SceneManager(this)
 *     await this.sceneManager.loadConfig()
 *
 *     // 加载默认场景
 *     await this.sceneManager.loadScene('fft-ocean')
 *
 *     // 或者从 URL 参数加载
 *     const urlParams = new URLSearchParams(window.location.search)
 *     const sceneId = urlParams.get('scene') || 'fft-ocean'
 *     await this.sceneManager.loadScene(sceneId)
 *   }
 *
 *   // 添加切换场景的方法
 *   async switchScene(sceneId: string) {
 *     await this.sceneManager.loadScene(sceneId)
 *   }
 * }
 * ```
 *
 * 在浏览器中使用：
 * - http://localhost:5173/?scene=fft-ocean
 * - http://localhost:5173/?scene=gerstner-wave
 * - http://localhost:5173/?scene=cube-scene
 *
 * 运行时切换场景：
 * ```javascript
 * // 在浏览器控制台
 * window.engine.switchScene('cave-scene')
 * ```
 */

import { Engine } from '@/engine'
import { EngineError } from '@/errors/EngineError/BaseError'
import { HttpError } from '@/errors/EngineError/NetworkError/HTTPError'
import { NetworkOfflineError } from '@/errors/EngineError/NetworkError/NetworkOfflineError'
import { WebGLRenderer } from '@/renderers/WebGLRenderer'
import { fetchWithTimeout } from '@/network/http'
import { CubeMapPreset } from '../CubemapManager/CubeMapPreset'
import { CubemapSourceType } from '../CubemapManager/types/CubeMapRender'
import { CubeMapRenderManager } from '../CubemapManager/CubeMapRenderManager'
import { ConfigNotFoundError } from '@/errors/EngineError/ConfigurationError/ConfigNotFoundError'
import { ConfigParseError } from '@/errors/EngineError/ConfigurationError/ConfigParseError'
import { ConfigValidationError } from '@/errors/EngineError/ConfigurationError/ConfigValidationError'
import { ConfigurationError } from '@/errors/EngineError/ConfigurationError/BaseError'
import { IBLEnvironment } from '../IBLEnvironment-Deprecated/IBLEnvironment'

// ==================== 类型定义 ====================
export interface SceneConfig {
  scenes: Record<string, SceneData>
  defaultScene: string
}

interface SceneData {
  name: string
  description: string
  camera: CameraConfig
  light: LightConfig
  environment?: EnvironmentConfig
  skybox?: SkyboxConfig
  entities: EntityConfig[]
}

interface CameraConfig {
  type: string
  position: [number, number, number]
  target: [number, number, number]
}

interface LightConfig {
  type: string
  radiance?: [number, number, number]
  position?: [number, number, number]
  direction?: { x: number; y: number; z: number }
}

interface EnvironmentConfig {
  type: 'HDR' | 'Skybox'
  path: string
  format: 'EXR' | 'HDR'
}

interface SkyboxConfig {
  enabled: boolean
  type: CubemapSourceType
  preset?: string
}

interface EntityConfig {
  type: 'FFTOcean' | 'GerstnerWave' | 'SineWave' | 'GLTF' | 'Axis'
  preset?: string
  path?: string
  name?: string
  material?: string
  enabled?: boolean
}

// ==================== 场景管理器 ====================
export class SceneManager {
  private gl: WebGLRenderingContext
  private engine: Engine
  private renderer: WebGLRenderer

  // 资源管理
  private loadedResources: Map<string, any> = new Map()

  // IBL环境
  private iblEnvironment: IBLEnvironment | null = null

  constructor(gl: WebGLRenderingContext, engine: Engine, renderer: WebGLRenderer) {
    this.gl = gl
    this.engine = engine
    this.renderer = renderer
  }

  /**
   * 加载场景配置文件
   *
   * @param configPath 配置文件路径
   * @param timeout 超时时间（毫秒）
   */
  // FIXME: configPath:string
  async loadConfig(configPath: string = '/configs/scene-config.json', timeout: number = 10000) {
    try {
      // 1. 检查网络连接
      if (!navigator.onLine) {
        throw new NetworkOfflineError(configPath)
      }

      // 2. 带超时的fetch
      const response = await fetchWithTimeout(configPath, { timeout })

      // 3. 检查HTTP状态
      if (!response.ok) {
        // 404 特殊处理
        if (response.status === 404) {
          throw new ConfigNotFoundError(configPath)
        }
        // 其他HTTP错误
        throw new HttpError(configPath, response.status, response.statusText)
      }

      // 4. 解析JSON
      let configData: any
      try {
        configData = response.json()
      } catch (parseError) {
        throw new ConfigParseError(configPath, parseError as Error)
      }

      // 5. 验证配置格式
      const validationErrors = this.validateConfig(configData)
      if (validationErrors.length > 0) {
        throw new ConfigValidationError(configPath, validationErrors)
      }
    } catch (error) {
      // 重新抛出自定义错误
      if (error instanceof EngineError) {
        throw error
      }

      // 未知错误包装
      console.error('❌ Failed to load scene config:', error)
      throw new ConfigurationError(
        `Failed to load configuration: ${configPath}`,
        'CONFIG_LOAD_FAILED',
        { configPath, cause: error as Error }
      )
    }
  }

  /**
   * 验证配置格式
   */
  validateConfig(config: unknown): string[] {
    const errors: string[] = []

    // 1️⃣ 必须是对象
    if (typeof config !== 'object' || config === null) {
      return ['Config must be an object']
    }

    const cfg = config as Record<string, unknown>

    // 检查必需字段
    if (!('scenes' in cfg)) {
      errors.push('Missing required field: scenes')
      return errors
    }
    if (!('defaultScene' in config)) {
      errors.push('Missing required field: defaultScene')
      return errors
    }

    if (typeof cfg.scenes !== 'object' || cfg.scenes === null) {
      errors.push('Field "scenes" must be an object')
      return errors
    }

    const scenes = cfg.scenes as Record<string, unknown>

    // 检查scenes结构
    for (const [sceneId, sceneData] of Object.entries(scenes)) {
      if (typeof sceneData !== 'object' || sceneData === null) {
        errors.push(`Scene "${sceneId}" must be an object`)
        continue
      }

      const scene = sceneData as Record<string, unknown>

      if (typeof scene.name !== 'string') {
        errors.push(`Scene "${sceneId}" missing field: name`)
      }
      if (typeof scene.camera !== 'object' || scene.camera === null) {
        errors.push(`Scene "${sceneId}" missing field: camera`)
      }
    }

    return errors
  }

  /**
   * 加载Skybox（原loadCubeMap）
   */
  private async loadSkybox(config: SkyboxConfig) {
    if (!config.enabled) {
      return
    }

    // 创建参数
    const skyboxParams = await CubeMapPreset.createSkybox(this.gl, config.type)

    const skyboxManager = new CubeMapRenderManager(this.gl, skyboxParams)
    await skyboxManager.initMeshRender()

    const skyboxMeshRender = skyboxManager.getMeshRender()
    if (!skyboxMeshRender) {
      throw new Error('')
    } else {
      this.renderer.addMeshRender(skyboxMeshRender)
    }
  }

  /**
   * 加载FFT Ocean（原loadFFTOcean）
   */
  // private async loadFFTOcean(config: EntityConfig): Promise<void> {
  //   // 创建配置
  //   const oceanConfig = await FFTOceanPresets.create(this.gl)

  //   // 创建Ocean渲染器
  //   const oceanManager = new FFTOceanRenderManager(
  //     this.gl,
  //     oceanConfig
  //   )

  //   // 添加到渲染器
  //   this.renderer.addMeshRender(oceanManager.meshRender)
  //   this.renderer.addToManagers(oceanManager, 'fftOcean')

  //   // 保存引用
  //   this.loadedResources.set('ocean', oceanManager)
  // }
}
