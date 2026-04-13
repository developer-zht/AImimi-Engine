import { WebGLExtensionError } from '@/errors/EngineError/WebGLError/WebGLExtensionError'
import { GLCapabilities } from './types/glCapabilities'

/** 全局 WebGL 能力标记，由 Engine.initGL 初始化 */
let _capabilities: GLCapabilities | null = null

/** 初始化 _capabilities[GLCapabilities]（仅 initGL 调用一次） */
export function initCapabilities(gl: WebGLRenderingContext): GLCapabilities {
  const ctx = '[GLCapabilities]'
  if (_capabilities) {
    console.warn('[GLCapabilities] Already initialized')
    return _capabilities
  }

  _capabilities = {
    floatTexture: !!gl.getExtension('OES_texture_float'),
    halfFloatTexture: !!gl.getExtension('OES_texture_half_float'),
    floatLinearFilter: !!gl.getExtension('OES_texture_float_linear'),
    depthTexture: !!gl.getExtension('WEBGL_depth_texture'),
    drawBuffers: !!gl.getExtension('WEBGL_draw_buffers')
  }

  console.log(`${ctx} `, _capabilities)
  return _capabilities
}

/** 获取 _capabilities[GLCapabilities]（任何地方直接 import 调用） */
export function getCapabilities(): GLCapabilities {
  if (!_capabilities) {
    throw new WebGLExtensionError(
      '[GLCapabilities]',
      '[GLCapabilities] Not initialized. Call initCapabilities() first.'
    )
  }

  return _capabilities
}
