import { FramebufferCreationError } from '@/errors/EngineError/FramebufferError/FramebufferCreationError'
import { TextureCreationError } from '@/errors/EngineError/TextureError/TextureCreationError'
import { WebGLExtensionError } from '@/errors/EngineError/WebGLError/WebGLExtensionError'
import { FramebufferIncompleteError } from '../errors/EngineError/FramebufferError/FramebufferIncompleteError'
import { RenderbufferCreationError } from '@/errors/EngineError/FramebufferError/RenderbufferCreationError'
import { FBOOptions } from './types/FBO'
import { getCapabilities } from '@/_config/glCapabilities'

export class FBO {
  private gl: WebGLRenderingContext
  private gl_draw_buffers: WEBGL_draw_buffers | null

  private readonly depthMode: 'renderbuffer' | 'texture'

  private width: number
  private height: number

  private framebuffer: WebGLFramebuffer | null = null
  private renderBufferObject: WebGLRenderbuffer | null = null
  private depthTexture: WebGLTexture | null = null

  private textures: WebGLTexture[] = [] // 纹理由 FBO 自己管理
  private attachments: GLenum[] = [] // 附件由 FBO 自己管理

  private colorTextureConfig

  constructor(gl: WebGLRenderingContext, options: FBOOptions) {
    this.gl = gl
    this.width = options.width
    this.height = options.height
    this.depthMode = options.depthMode ?? 'renderbuffer'

    // MRT 需要 WEBGL_draw_buffers 扩展
    const colorAttachmentCount = options.colorAttachmentCount ?? 1
    if (colorAttachmentCount < 0) {
      throw new FramebufferCreationError(this.width, this.height, {
        reason: `colorAttachmentCount cannot be negative (got ${colorAttachmentCount})`
      })
    }
    // MRT 需要 WEBGL_draw_buffers 扩展，而单 attachment 则不需要
    if (colorAttachmentCount > 1) {
      this.gl_draw_buffers = gl.getExtension('WEBGL_draw_buffers')
      if (!this.gl_draw_buffers) {
        throw new WebGLExtensionError('WEBGL_draw_buffers')
      }
    } else {
      this.gl_draw_buffers = null
    }

    // depth texture 需要 WEBGL_depth_texture 扩展
    if (this.depthMode === 'texture') {
      const ext = gl.getExtension('WEBGL_depth_texture')
      if (!ext) {
        throw new WebGLExtensionError('WEBGL_depth_texture')
      }
    }

    const ctc = options.colorTextureConfig
    this.colorTextureConfig = {
      internalFormat: ctc?.internalFormat ?? gl.RGBA,
      format: ctc?.format ?? gl.RGBA,
      type: ctc?.type ?? gl.UNSIGNED_BYTE,
      minFilter: ctc?.minFilter ?? gl.NEAREST,
      magFilter: ctc?.magFilter ?? gl.NEAREST,
      wrapS: ctc?.wrapS ?? gl.CLAMP_TO_EDGE,
      wrapT: ctc?.wrapT ?? gl.CLAMP_TO_EDGE
    }

    this.initFrameBuffer(colorAttachmentCount)
  }

  // 初始化 framebuffer
  private initFrameBuffer(colorAttachmentCount: number) {
    const gl = this.gl

    //创建帧缓冲区对象
    this.framebuffer = gl.createFramebuffer()
    if (!this.framebuffer) {
      console.error('无法创建帧缓冲区对象')
      throw new FramebufferCreationError(this.width, this.height)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)

    // Color attachments
    if (colorAttachmentCount > 1) {
      // MRT：用扩展的 COLOR_ATTACHMENT0_WEBGL
      const colorAttachment0 = this.gl_draw_buffers!.COLOR_ATTACHMENT0_WEBGL

      for (let i = 0; i < colorAttachmentCount; i++) {
        const attachment: GLenum = colorAttachment0 + i
        const texture = this.createAndBindColorTargetTexture(attachment)
        this.attachments.push(attachment)
        this.textures.push(texture)
      }

      this.gl_draw_buffers!.drawBuffersWEBGL(this.attachments)
    } else if (colorAttachmentCount === 1) {
      // 单 attachment：直接用 gl.COLOR_ATTACHMENT0，不需要扩展
      const attachment = gl.COLOR_ATTACHMENT0
      const texture = this.createAndBindColorTargetTexture(attachment)
      this.attachments.push(attachment)
      this.textures.push(texture)
    }
    // colorAttachmentCount === 0：跳过，比如 depth-only FBO

    // 创建深度缓冲区
    if (this.depthMode === 'texture') {
      this.createDepthTexture()
    } else {
      this.createDepthRenderbuffer()
    }

    // 检查帧缓冲区完整性
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new FramebufferIncompleteError(status, this.width, this.height, colorAttachmentCount)
    }

    this.gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    this.gl.bindTexture(gl.TEXTURE_2D, null)
    this.gl.bindRenderbuffer(gl.RENDERBUFFER, null)
  }

  //创建纹理对象并设置其尺寸和参数
  private createAndBindColorTargetTexture(attachment: GLenum): WebGLTexture {
    const gl = this.gl
    const config = this.colorTextureConfig

    // 检查 OES_texture_float 扩展，该扩展允许 WebGL 使用浮点数像素类型的纹理
    if (config.type === gl.FLOAT) {
      if (!getCapabilities().floatTexture) throw new WebGLExtensionError('OES_texture_float')
    }
    // float 纹理 + 线性过滤 → 需要扩展 ==> 检查 OES_texture_float_linear 扩展
    if (
      config.type === gl.FLOAT &&
      (config.minFilter === gl.LINEAR || config.magFilter === gl.LINEAR)
    ) {
      if (!getCapabilities().floatLinearFilter) {
        console.warn('[FBO] OES_texture_float_linear not supported, falling back to NEAREST')
        config.minFilter = gl.NEAREST
        config.magFilter = gl.NEAREST
      }
    }
    // 检查 OES_texture_half_float 扩展，该扩展允许 WebGL 使用 16 位浮点数（半精度）像素类型的纹理
    if (config.type === 0x8d61) {
      // HALF_FLOAT_OES
      if (!getCapabilities().halfFloatTexture)
        throw new WebGLExtensionError('OES_texture_half_float')
    }

    const width = this.width
    const height = this.height

    const texture = gl.createTexture()
    if (!texture) {
      console.warn('无法创建纹理对象')
      throw new TextureCreationError('TEXTURE_2D')
    }
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0, // mipmap level
      config.internalFormat, // 默认 gl.RGBA
      width,
      height,
      0, // border
      config.format, // 默认 gl.RGBA
      config.type, // 默认 gl.UNSIGNED_BYTE
      null
    )

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, config.minFilter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, config.magFilter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, config.wrapS)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, config.wrapT)

    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, texture, 0)

    return texture
  }

  /**
   * 创建 depth renderbuffer（不可采样，仅用于深度测试）
   *
   * 适用场景：正常渲染（只需要深度测试，不需要在 shader 中读取深度）
   */
  // 创建渲染缓冲对象，其为 depth buffer 的一种实现方式，深度测试时使用这个 rbo
  // 详见 https://learnopengl-cn.github.io/04%20Advanced%20OpenGL/05%20Framebuffers/
  private createDepthRenderbuffer(): void {
    const gl = this.gl
    const width = this.width
    const height = this.height

    // 创建一个 renderbuffer object（渲染缓冲对象）存储 depth test 时的信息
    this.renderBufferObject = gl.createRenderbuffer()
    if (!this.renderBufferObject) {
      throw new RenderbufferCreationError(width, height)
    }
    // 将 rbo 绑定到当前的 RENDERBUFFER 槽中
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderBufferObject)
    // 为当前绑定到 RENDERBUFFER 槽位的数据（即 rbo）分配内存，内部数据格式为 DEPTH_COMPONENT16
    gl.renderbufferStorage(
      gl.RENDERBUFFER, // 操作目标，表示当前绑定到 RENDERBUFFER 槽位的对象
      gl.DEPTH_COMPONENT16, // 内部格式，16 位深度格式，每像素 2 字节
      width, // 渲染缓冲的宽度尺寸
      height // 渲染缓冲的高度尺寸
    )
    // 将指定的 rbo 附加到当前帧缓冲的 DEPTH_ATTACHMENT，建立引用关系
    gl.framebufferRenderbuffer(
      gl.FRAMEBUFFER, // 帧缓冲目标，操作当前绑定的 framebuffer
      gl.DEPTH_ATTACHMENT, // 深度附件点，帧缓冲内部专门用于深度测试的"插槽"
      gl.RENDERBUFFER, // 对象类型，表明要附加渲染缓冲（不是纹理）
      this.renderBufferObject // 具体的渲染缓冲对象 ID
    )
  }

  /**
   * 创建 depth texture（可采样）
   *
   * 适用场景：
   * - Shadow mapping（main pass 需要采样灯光视角的深度）
   * - 延迟渲染（G-Buffer 需要深度信息）
   * - 后处理（SSAO、DoF 等需要深度）
   *
   * 需要 WEBGL_depth_texture 扩展
   */
  private createDepthTexture() {
    const gl = this.gl

    this.depthTexture = gl.createTexture()
    if (!this.depthTexture) {
      throw new TextureCreationError('TEXTURE_2D', {
        reason: 'Failed to create depth texture'
      })
    }

    gl.bindTexture(gl.TEXTURE_2D, this.depthTexture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.DEPTH_COMPONENT, // 内部格式
      this.width,
      this.height,
      0,
      gl.DEPTH_COMPONENT, // 格式
      gl.UNSIGNED_INT, // 类型（WEBGL_depth_texture 要求）
      null
    )

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.TEXTURE_2D,
      this.depthTexture,
      0
    )
  }

  // ============================================================
  //  bind & unbind
  // ============================================================

  bind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer)
    // MRT 时重新设置 draw buffers
    if (this.gl_draw_buffers && this.attachments.length > 1) {
      this.gl_draw_buffers.drawBuffersWEBGL(this.attachments)
    }
  }

  unbind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
  }

  // ============================================================
  //  Getters
  // ============================================================

  /** 获取 framebuffer 属性 */
  getFrameBuffer(): WebGLFramebuffer | null {
    return this.framebuffer
  }

  /** 获取所有 texture */
  getTextures(): WebGLTexture[] {
    return this.textures
  }

  /** 获取指定 texture */
  getTexture(index: number): WebGLTexture | undefined {
    return this.textures[index]
  }

  /**
   * 获取 depth texture（仅 depthMode='texture' 时有值）
   *
   * 用于在 shader 中采样深度：texture2D(uDepthMap, uv).r
   */
  getDepthTexture(): WebGLTexture | null {
    return this.depthTexture
  }

  /** 获取 width */
  getWidth(): number {
    return this.width
  }

  /** 获取 height */
  getHeight(): number {
    return this.height
  }

  // ============================================================
  //  Dispose
  // ============================================================

  // 清理资源
  dispose(): void {
    const gl = this.gl

    // 删除纹理
    for (const texture of this.textures) {
      gl.deleteTexture(texture)
    }
    this.textures = []
    this.attachments = []

    // 删除深度纹理
    if (this.depthTexture) {
      gl.deleteTexture(this.depthTexture)
      this.depthTexture = null
    }

    // 删除深度缓冲区
    if (this.renderBufferObject) {
      gl.deleteRenderbuffer(this.renderBufferObject)
      this.renderBufferObject = null
    }

    // 删除帧缓冲区
    if (this.framebuffer) {
      gl.deleteFramebuffer(this.framebuffer)
      this.framebuffer = null
    }
  }
}
