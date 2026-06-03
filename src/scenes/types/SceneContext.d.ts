import { WebGLRenderer } from '@/renderers/WebGLRenderer'
import { GUI } from 'dat.gui'
import { PerspectiveCamera } from 'three'
import { OrbitControls } from 'three/examples/jsm/Addons.js'

/** 场景加载器需要的运行时上下文 */
export interface SceneContext {
  gl: WebGLRenderingContext
  renderer: WebGLRenderer
  camera: PerspectiveCamera
  controls: OrbitControls
  gui?: GUI // 可选，生产环境可以不传
}
