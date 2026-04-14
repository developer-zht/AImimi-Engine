// import * as THREE from 'three'
import { PerspectiveCamera } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GUI } from 'dat.gui'

// import { WebGLRenderer } from '@/renderers/WebGLRenderer'
import { WebGLRenderer } from '@/renderers/WebGLRenderer-refactor'
import { FBO } from './framebuffers/FBO'
import { loadWater } from '@/managers/water/WaterRenderManager'
import { WaterPresets } from '@/managers/water/WaterPresets'
import { loadGLTF } from '@/loaders/loadGLTF'
import { DirectionalLight } from '@/lights/directionalLight/DirectionalLight'

import type { LightParams } from '@/lights/types/light'
import { CameraType, SceneType, LightType } from '@/types/engine'
import { Vec3 } from '@/math/types/math'

import { PerformanceMonitor } from '@/monitors/PerformanceMonitor'
import { loadCubeMap } from './managers/CubemapManager/CubeMapRenderManager'
import { CubeMapPreset } from '@/managers/CubemapManager/CubeMapPreset'
import { CubemapSourceType } from '@/managers/CubemapManager/types/CubeMapRender'
import { loadFFTOcean } from './managers/fftOcean/FFTOceanRenderManager'
import { FFTOceanPresets } from './managers/fftOcean/FFTOceanPresets'
import { HDRBasedCubeMapTexture } from './textures/converters/HDRBasedCubeMapTexture-deprecated'
import { HighDynamicRangeTextureLoader } from '@/loaders/HighDynamicRangeTextureLoader-Deprecated/HighDynamicRangeTextureLoader'
import { TexturePaths } from './_config/basePaths'
import { AxisManagerParams, loadAxis } from './managers/AxisManager/AxisManager-deprecated'
import { AxisPreset } from './managers/AxisManager/AxisPresets'
import { HighDynamicRangeTextureType } from '@/loaders/HighDynamicRangeTextureLoader-Deprecated/types/HighDynamicRangeTextureLoader'
import { WebGLNotSupportedError } from './errors/EngineError/WebGLError/WebGLNotSupportedError'
import { WebGLExtensionError } from './errors/EngineError/WebGLError/WebGLExtensionError'
import { WebGLContextLostError } from './errors/EngineError/WebGLError/WebGLContextLostError'
import { createFFTOceanRenderer } from './managers/fftOcean/createFFTOceanRenderer'
import { createAxisRenderer } from './managers/AxisManager/createAxisRenderer'
import { Transform } from './objects/utils/Transform'

export class Engine {
  // public
  // 上下文属性
  public canvas: HTMLCanvasElement
  public gl: WebGLRenderingContext
  public gl_draw_buffers: WEBGL_draw_buffers
  // 相机相关属性
  private cameraPosition: [number, number, number] // 相机位置
  private cameraTarget: [number, number, number] // 相机观察的目标点
  public camera: PerspectiveCamera
  private cameraControls: OrbitControls
  // 渲染器
  public renderer: WebGLRenderer

  private perfMonitor: PerformanceMonitor

  constructor(canvas: HTMLCanvasElement) {
    // 上下文属性
    this.canvas = canvas
    // this.gl = new WebGLRenderingContext()
    // this.gl_draw_buffers = null

    // // 相机相关属性
    // this.cameraPosition = [0,0,0] // 相机位置
    // this.cameraTarget = [0,0,0] // 相机观察的目标点
    // this.camera = null
    // this.cameraControls = null

    // // 渲染器
    // this.renderer = null

    // 初始化渲染流程
    // this.init()

    this.setupCanvas()
    // 初始化上下文
    this.initGL()
    this.setupGLViewport()
    // 初始化相机和控制参数
    // this.initCameraParams('CubeSceneCamera')
    this.initCameraParams(CameraType.WATER_SCENE_CAMERA)
    this.initCamera()
    this.setupCamera()
    this.initCameraControls()

    // 初始化渲染器
    this.initRenderer()

    // 加载灯光
    // this.addLight(LightType.CUBE_LIGHT)
    // this.addLight(LightType.WAVE_LIGHT)
    // 加载调参面板
    // this.initGUI()
    // 初始化性能检测器
    this.initPerformanceMonitor()

    window.addEventListener('resize', () => {
      console.log('resize')

      this.setupCanvas()
      this.setupGLViewport()
      this.setupCamera()
    })

    console.log('Class Engine has initialized')
  }

  async init() {
    // this.setupCanvas()
    // // 初始化上下文
    // this.initGL()
    // this.setupGLViewport()
    // // 初始化相机和控制参数
    // // this.initCameraParams('CubeSceneCamera')
    // this.initCameraParams(CameraType.WATER_SCENE_CAMERA)
    // this.initCamera()
    // this.setupCamera()
    // this.initCameraControls()

    // // 初始化渲染器
    // this.initRenderer()

    // // 加载灯光
    // // this.addLight(LightType.CUBE_LIGHT)
    // this.addLight(LightType.WAVE_LIGHT)
    // // 加载调参面板
    // // this.initGUI()
    // // 初始化性能检测器
    // this.initPerformanceMonitor()

    // 加载坐标轴
    // const axisManagerParams: AxisManagerParams = AxisPreset.createAxis()
    // await loadAxis(this.renderer, axisManagerParams)
    const axisRenderer = await createAxisRenderer(this.gl, {
      transform: Transform.identity()
    })
    this.renderer.addHUDRenderer(axisRenderer, { x: 0.05, y: 0.05 }, 120)

    /**
     * 初始化 IBL（只在程序启动时执行一次）
     *
     * 加载 IBL 预计算的 Texture
     * EXR file path: 'public/assets/textures/environment/skies/qwantani_moonrise_puresky_2k/puresky.exr'
     * HDR file path: 'public/assets/textures/environment/skies/qwantani_moonrise_puresky_2k/puresky.hdr'
     * EXR file path: 'public/assets/textures/environment/skies/EveningSkyHDRI039B/EveningSkyHDRI039B_2K-HDR.exr'
     */
    // 使用 Threejs 的 HDR(EXR) loader 加载 DataTexture
    // const hdrDataTextureLoader = new HighDynamicRangeTextureLoader(this.gl)
    // const hdrDataTexture = await hdrDataTextureLoader.loadHDRDataTexture(
    // TexturePaths.EVENING_SKY_HDRI039B_EXR,
    // TextureFileType.EXR
    // )
    // ==================== 以下为需要恢复的内容 ====================
    // const highDynamicRangeTextureLoader = new HighDynamicRangeTextureLoader()
    // const hdrDataTexture = await highDynamicRangeTextureLoader.load(
    //   TexturePaths.EVENING_SKY_HDRI039B_EXR,
    //   HighDynamicRangeTextureType.EXR
    // )
    // // 用 Threejs loader 加载的 DataTexture 创建 CubeMap Texture
    // const hdrCubeMapTexture = HDRBasedCubeMapTexture.getInstance(this.gl)
    // await hdrCubeMapTexture.init(hdrDataTexture)
    // ============================================================

    // 加载场景
    // this.loadSceneGLTF(SceneType.CUBE_SCENE)
    // this.loadSceneGLTF(SceneType.CAVE_SCENE)
    // ==================== 以下为需要恢复的内容 ====================
    // 加载 skybox
    // const cubeMapRenderManagerParams = await CubeMapPreset.createSkybox(
    //   this.gl,
    //   CubemapSourceType.IMG_CUBE_MAP
    // )
    // await loadCubeMap(this.renderer, cubeMapRenderManagerParams)
    // ============================================================
    // 加载水场景
    // loadWater(this.renderer, WaterPresets.getInstance(this.renderer.gl).createSineWave())
    // loadWater(this.renderer, WaterPresets.getInstance(this.renderer.gl).createGerstnerWaves())
    // 加载 FFT Ocean
    const fftOceanRenderManagerConfig = await FFTOceanPresets.getInstance(
      this.gl
    ).createFFTOceanParams()
    // await loadFFTOcean(this.renderer, fftOceanRenderManagerConfig)
    const { renderer, computeManager } = await createFFTOceanRenderer(
      this.gl,
      fftOceanRenderManagerConfig
    )
    renderer.addManager(computeManager)
    this.renderer.addRender(renderer)
  }

  // 初始化上下文
  private initGL() {
    const gl = this.canvas.getContext('webgl')

    if (!gl) {
      alert('Unable to initialize WebGL. Your browser or machine may not support it.')
      // throw new Error('Unable to initialize WebGL. Your browser or machine may not support it.')
      throw new WebGLNotSupportedError()
    }

    // 设置颜色空间
    gl.drawingBufferColorSpace = 'srgb'

    // 以下功能不需要额外库，都是 WebGL 的标准扩展（这些扩展只在 WebGL1 中需要显式启用，在 WebGL2 中都是默认可用的）
    // 启用 OES_element_index_uint 扩展，支持超过 UNSIGNED_SHORT (16位无符号整数) 存储的最大值 65535
    const ext = gl.getExtension('OES_element_index_uint')
    if (!ext) {
      // throw new Error('OES_element_index_uint 扩展不支持，无法使用超过 65535 的索引。')
      throw new WebGLExtensionError('OES_element_index_uint')
    }
    // 启用 OES_texture_float 扩展，该扩展允许 WebGL 使用浮点数像素类型的纹理
    const extFloat = gl.getExtension('OES_texture_float')
    if (!extFloat) {
      // throw new Error(
      //   '❌ OES_texture_float extension not supported - Your browser/GPU may not support floating-point textures.'
      // )
      throw new WebGLExtensionError('OES_texture_float')
    }
    // 启用 OES_texture_half_float 扩展，该扩展允许 WebGL 使用 16 位浮点数（半精度）像素类型的纹理
    const extHalfFloat = gl.getExtension('OES_texture_half_float')
    if (!extHalfFloat) {
      // throw new Error(
      //   '❌ OES_texture_half_float extension not supported - Half-float textures are required for HDR rendering.'
      // )
      throw new WebGLExtensionError('OES_texture_half_float')
    }
    // 允许对浮点纹理使用线性过滤（LINEAR），否则只能 NEAREST
    const extTexFloatLinear = gl.getExtension('OES_texture_float_linear')
    if (!extTexFloatLinear) {
      // throw new Error(
      //   '❌ OES_texture_float_linear extension not supported - Linear filtering for float textures is disabled (fallback to NEAREST).'
      // )
      throw new WebGLExtensionError('OES_texture_float_linear')
    }
    // 启用 WEBGL_draw_buffers 扩展
    const gl_draw_buffers = gl.getExtension('WEBGL_draw_buffers')
    if (!gl_draw_buffers) {
      // throw new Error(
      //   '❌ WEBGL_draw_buffers extension not supported - Linear filtering for float textures is disabled (fallback to NEAREST).'
      // )
      throw new WebGLExtensionError('WEBGL_draw_buffers')
    }
    this.gl_draw_buffers = gl_draw_buffers
    // 查询系统支持的最大绘制缓冲区数量
    const maxdb = gl.getParameter(this.gl_draw_buffers.MAX_DRAW_BUFFERS_WEBGL)
    console.log('MAX_DRAW_BUFFERS_WEBGL: ' + maxdb)

    // 监听上下文丢失
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault()
      throw new WebGLContextLostError()
    })

    this.gl = gl
  }
  private setupGLViewport() {
    // ✅ 设置 WebGL 视口（只在这里设置一次，后续无需在 draw 方法中设置）
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
  }

  // 初始化场景中的相机和控件参数
  private initCameraParams(CameraType: CameraType) {
    switch (CameraType) {
      case 'CubeSceneCamera':
        this.cameraPosition = [6, 1, 0]
        this.cameraTarget = [0, 0, 0]
        break
      case 'CaveSceneCamera':
        this.cameraPosition = [4.18927, 1.0313, 2.07331]
        this.cameraTarget = [2.92191, 0.98, 1.55037]
        break
      case 'WaterSceneCamera':
        this.cameraPosition = [70, 20, 50]
        this.cameraTarget = [0, 0, 0]
        break
      default:
        this.cameraPosition = [6, 1, 0]
        this.cameraTarget = [0, 0, 0]
    }
  }
  // 初始化相机
  private initCamera() {
    const camera = new PerspectiveCamera(
      75,
      this.canvas.clientWidth / this.canvas.clientHeight,
      0.1,
      1000
    )

    camera.position.set(this.cameraPosition[0], this.cameraPosition[1], this.cameraPosition[2])
    // let fbo = new FBO(this.gl, this.gl_draw_buffers)
    // camera.fbo = new FBO(this.gl, this.gl_draw_buffers).getFrameBuffer()
    camera.fbo = new FBO(this.gl).getFrameBuffer()
    this.camera = camera
  }
  // 设置相机 FOV 和投影矩阵
  private setupCamera() {
    this.camera.aspect = this.canvas.width / this.canvas.height
    this.camera.updateProjectionMatrix()
  }
  // 初始化相机控制对象
  private initCameraControls() {
    const cameraControls = new OrbitControls(this.camera, this.canvas)
    // 设置更小的最小距离，允许更近的放大
    cameraControls.minDistance = 0.1 // 或者更小的值
    cameraControls.maxDistance = 1000 // 设置合理的最大距离
    // 启用鼠标缩放，缩放速度为 1.0 倍标准速度
    cameraControls.enableZoom = true
    cameraControls.zoomSpeed = 1.0
    // 启用鼠标旋转，旋转速度为 0.3 倍标准速度
    cameraControls.enableRotate = true
    cameraControls.rotateSpeed = 0.3
    // 启用鼠标平移，平移速度为 0.8 倍标准速度
    cameraControls.enablePan = true
    cameraControls.panSpeed = 0.8
    // cameraControls.target.set 必须在 camera.position.set 之后执行，而且参数不能为 null 或者 undefined，否则会影响 camera.position 中的值
    cameraControls.target.set(this.cameraTarget[0], this.cameraTarget[1], this.cameraTarget[2])

    this.cameraControls = cameraControls
  }

  // 加载场景
  private loadSceneGLTF(sceneType: SceneType) {
    switch (sceneType) {
      case 'CubeScene':
        loadGLTF(this.renderer, 'assets/cube/', 'cube1', 'SSRMaterial')
        // loadGLTF(this.renderer, 'assets/cube/', 'cube2', 'SSRMaterial')
        break
      case 'CaveScene':
        loadGLTF(this.renderer, 'assets/cave/', 'cave', 'SSRMaterial')
        break
      default:
        return
    }
  }

  // 初始化渲染器
  private initRenderer() {
    // const renderer = new WebGLRenderer(this.gl, this.gl_draw_buffers, this.camera)
    const renderer = new WebGLRenderer(this.gl, this.gl_draw_buffers, this.camera)
    this.renderer = renderer
  }

  // 添加灯光
  private addLight(lightType: LightType) {
    const lightUp: Vec3 = [1, 0, 0]
    const lightParams = this.getLightParams(lightType)

    const directionLight = new DirectionalLight(
      lightParams.lightRadiance,
      lightParams.lightPos,
      lightParams.lightDir,
      lightUp,
      this.gl,
      this.gl_draw_buffers
    )

    this.renderer.addLight(directionLight)
    // console.log(this.renderer.lights)
  }
  // 返回灯光参数
  private getLightParams(lightType: LightType): LightParams {
    switch (lightType) {
      case LightType.CUBE_LIGHT:
        return {
          lightRadiance: [1, 1, 1],
          lightPos: [-2, 4, 1],
          lightDir: {
            x: 0.4,
            y: -0.9,
            z: -0.2
          }
        }
      case LightType.CAVE_LIGHT:
        return {
          lightRadiance: [20, 20, 20],
          lightPos: [-0.45, 5.40507, 0.637043],
          lightDir: {
            x: 0.39048811,
            y: -0.89896828,
            z: 0.19843153
          }
        }
      case LightType.WAVE_LIGHT:
        return {
          lightRadiance: [10, 10, 10],
          lightPos: [1, 500, 0],
          lightDir: {
            x: 0.39048811,
            y: -0.89896828,
            z: 0.19843153
          }
        }
      default:
        return {
          lightRadiance: [1, 1, 1],
          lightPos: [0, 0, 0],
          lightDir: {
            x: 0,
            y: 0,
            z: 0
          }
        }
    }
  }

  // 初始化 GUI 调参面板
  private initGUI() {
    const gui = new GUI()
    const lightPanel = gui.addFolder('Directional Light')

    lightPanel.add(this.renderer.lights[0].entity.lightDir, 'x', -10, 10, 0.1)
    lightPanel.add(this.renderer.lights[0].entity.lightDir, 'y', -10, 10, 0.1)
    lightPanel.add(this.renderer.lights[0].entity.lightDir, 'z', -10, 10, 0.1)
    lightPanel.open()
  }

  // 初始化性能检测器
  private initPerformanceMonitor() {
    const perfMonitor = new PerformanceMonitor()
    this.perfMonitor = perfMonitor
  }

  private setupCanvas() {
    const dpr = window.devicePixelRatio || 1

    // 不出现滚动条的做法：使用元素自身的 clientWidth/clientHeight，这能确保 Canvas 的显示尺寸严格在其父容器范围内
    const displayWidth = window.innerWidth
    const displayHeight = window.innerHeight

    // 绘图缓冲区 = 视口尺寸 × DPR
    this.canvas.width = displayWidth * dpr
    this.canvas.height = displayHeight * dpr

    // CSS显示尺寸 = 视口尺寸
    this.canvas.style.width = displayWidth + 'px'
    this.canvas.style.height = displayHeight + 'px'
  }

  // 启动渲染
  public mainLoop() {
    this.cameraControls.update()
    this.renderer.render()
    this.perfMonitor.update()
    requestAnimationFrame(() => this.mainLoop())
    // console.log('mainLoop is running')
  }
}
