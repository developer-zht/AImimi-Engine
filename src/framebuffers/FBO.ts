import { FramebufferCreationError } from '@/errors/EngineError/FramebufferError/FramebufferCreationError'
import { TextureCreationError } from '@/errors/EngineError/TextureError/TextureCreationError'
import { WebGLExtensionError } from '@/errors/EngineError/WebGLError/WebGLExtensionError'
import { FramebufferIncompleteError } from '../errors/EngineError/FramebufferError/FramebufferIncompleteError'
import { RenderbufferCreationError } from '@/errors/EngineError/FramebufferError/RenderbufferCreationError'
import { ColorTextureConfig, FBOOptions } from './types/FBO'
import { getCapabilities } from '@/_config/glCapabilities'
import { isPowerOf2 } from '@/math/isPowerOf2'
import { FramebufferReleaseError } from '@/errors/EngineError/FramebufferError/FramebufferReleaseError'

export class FBO {
  private gl: WebGLRenderingContext
  private gl_draw_buffers: WEBGL_draw_buffers | null

  private readonly depthMode: 'renderbuffer' | 'texture'

  private width: number
  private height: number

  private framebuffer: WebGLFramebuffer | null = null
  private renderBufferObject: WebGLRenderbuffer | null = null
  private depthTexture: WebGLTexture | null = null

  private textures: (WebGLTexture | null)[] = [] // 纹理由 FBO 自己管理，null = 该槽已 release
  private attachments: GLenum[] = [] // 附件由 FBO 自己管理
  private released: boolean = false // texture 是否已被释放，bind() 时警告

  private colorTextureConfig: Required<ColorTextureConfig>

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
      wrapT: ctc?.wrapT ?? gl.CLAMP_TO_EDGE,
      generateMipmap: ctc?.generateMipmap ?? false
    }

    this.initFrameBuffer(colorAttachmentCount)
  }

  // 初始化 framebuffer
  private initFrameBuffer(colorAttachmentCount: number) {
    const gl = this.gl

    // 创建帧缓冲区对象
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

  // 创建纹理对象并设置其尺寸和参数
  private createAndBindColorTargetTexture(attachment: GLenum): WebGLTexture {
    const gl = this.gl
    const config = this.colorTextureConfig

    // 校验 Texture Config
    this.checkTexureConfig(config)

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

    if (config.generateMipmap) {
      gl.generateMipmap(gl.TEXTURE_2D)
    }

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
    if (this.released) {
      // FBO 已经把 texture 交出去了，外部（caller）拿在手里、可能正在用；如果你这时候再 fbo.bind() 渲染，渲染会写到那张已经被 caller 持有的 texture 上——形成两个"使用者"同时写同一张纹理的混乱局面。
      console.warn(
        '[FBO.bind] FBO 已 release texture，bind 后渲染会写到 caller 持有的 texture 中。' +
          '通常你想立刻 dispose() 而不是再 bind()。'
      )
    }

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
  //  release texture(s)
  // ============================================================
  /**
   * 把指定 attachment 的 texture 所有权转移给调用方。
   *
   * 转移后：
   *   - 该 texture 不会被本 FBO 的 dispose() 删除
   *   - 该槽 textures[index] 标记为 null（保持索引稳定，不 splice）
   *   - FBO 进入 "released" 状态，再次 bind() 会发出警告
   *
   * MRT 注意：
   *   - 单 attachment FBO 调用是安全的（之后立即 dispose 即可）
   *   - MRT FBO 部分释放 = drawBuffersWEBGL 行为未定义；
   *     MRT 场景请用 releaseAllTextures()
   *
   * @throws 如果 index 越界或该槽已被释放或者 MRT 场景
   */
  releaseTexture(index: number): WebGLTexture {
    if (this.attachments.length > 1) {
      throw new FramebufferReleaseError(this.width, this.height, {
        reason:
          '[FBO.releaseTexture] MRT FBO 不允许部分释放——会让 drawBuffersWEBGL 的 attachment 索引和 textures 数组失配。' +
          '请用 releaseAllTextures() 后调用 gl.deleteTexture() 丢弃不要的纹理。',
        context: { attachmentCount: this.attachments.length, requestedIndex: index }
      })
    }

    const tex = this.textures[index]
    if (!tex) {
      throw new FramebufferReleaseError(this.width, this.height, {
        reason: `[FBO.releaseTexture] index=${index}：纹理不存在或已被释放`,
        context: { requestedIndex: index, textureCount: this.textures.length }
      })
    }
    this.textures[index] = null
    this.released = true

    return tex
  }

  /**
   * 一次性把所有 attachment 的 texture 转移给调用方。
   * 通常用于 MRT FBO bake 出多张 texture 后批量交出。
   *
   * @returns 按 attachment index 顺序的 WebGLTexture 数组（不含 null）
   */
  releaseAllTexture(): WebGLTexture[] {
    const result: WebGLTexture[] = []

    for (let i = 0; i < this.textures.length; i++) {
      const tex = this.textures[i]
      if (tex) {
        result.push(tex)
        this.textures[i] = null
      }
    }
    this.released = true

    return result
  }

  // ============================================================
  //  mipmap
  // ============================================================
  /**
   * 重新生成所有 color texture 的 mipmap 链
   *
   * 用途：每帧向 FBO 渲染新内容后调用，让远距离采样可以用到最新的低分辨率层级
   *
   * 只对构造时配置了 generateMipmap=true 的 FBO 生效，
   * 其他 FBO 调用此方法是安全的 no-op（避免调用方需要判断）
   */
  regenerateMipmaps(): void {
    if (!this.colorTextureConfig.generateMipmap) return

    const gl = this.gl
    for (const tex of this.textures) {
      if (!tex) continue // tex 为 null 时跳过
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.generateMipmap(gl.TEXTURE_2D)
    }
    gl.bindTexture(gl.TEXTURE_2D, null)
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
    return this.textures.filter((tex) => tex !== null)
  }

  /** 获取指定 texture */
  getTexture(index: number): WebGLTexture | undefined {
    return this.textures[index] ?? undefined // null → undefined，
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
  //  Check Texture Config
  // ============================================================
  private checkTexureConfig(config: Required<ColorTextureConfig>) {
    const gl = this.gl

    // --- Step 0：FLOAT / HALF_FLOAT 纹理存在性校验（最基础，不降级，必须抛） ---
    // 检查 OES_texture_float 扩展，该扩展允许 WebGL 使用浮点数像素类型的纹理
    if (config.type === gl.FLOAT) {
      if (!getCapabilities().floatTexture) throw new WebGLExtensionError('OES_texture_float')
    }

    // 检查 OES_texture_half_float 扩展，该扩展允许 WebGL 使用 16 位浮点数（半精度）像素类型的纹理
    if (config.type === 0x8d61) {
      // HALF_FLOAT_OES
      if (!getCapabilities().halfFloatTexture)
        throw new WebGLExtensionError('OES_texture_half_float')
    }

    // --- Step 1：POT + mipmap 兼容性（降级 mipmap filter）---
    if (config.generateMipmap || this.isMipmapFilter(config.minFilter, gl)) {
      const isPot = isPowerOf2(this.width) && isPowerOf2(this.height)
      if (!isPot) {
        console.warn(
          `[FBO] Non-POT dimensions (${this.width}×${this.height}) in WebGL1: ` +
            'mipmap disabled, minFilter downgraded'
        )
        config.generateMipmap = false
        // minFilter 现在只可能是 NEAREST 或 LINEAR
        config.minFilter = this.stripMipmap(config.minFilter, gl)
      }
    }

    // --- Step 2：FLOAT + LINEAR 兼容性（此时 minFilter 已是最终值）---
    const needsFloatLinear =
      config.type === gl.FLOAT &&
      (this.hasIntraLevelLinear(config.minFilter, gl) ||
        this.hasInterLevelLinear(config.minFilter, gl) ||
        config.magFilter === gl.LINEAR)

    if (needsFloatLinear && !getCapabilities().floatLinearFilter) {
      console.warn(
        '[FBO] OES_texture_float_linear not supported: ` + `LINEAR filters downgraded to NEAREST'
      )
      // 所有 LINEAR 系列全部降级
      if (this.hasIntraLevelLinear(config.minFilter, gl)) {
        config.minFilter =
          this.stripMipmap(config.minFilter, gl) === gl.LINEAR ? gl.NEAREST : config.minFilter
      }
      // 处理跨层 linear（NEAREST_MIPMAP_LINEAR → NEAREST_MIPMAP_NEAREST）
      if (config.minFilter === gl.NEAREST_MIPMAP_LINEAR) {
        config.minFilter = gl.NEAREST_MIPMAP_NEAREST
      }
      if (config.magFilter === gl.LINEAR) {
        config.magFilter = gl.NEAREST
      }
      // 注意：mipmap 本身不需要关（NEAREST_MIPMAP_NEAREST 仍可工作）
    }
  }

  // ============================================================
  //  Helper
  // ============================================================
  /** 某个 minFilter 是否属于 mipmap 系列（需要 mipmap 链存在） */
  private isMipmapFilter(filter: GLenum, gl: WebGLRenderingContext): boolean {
    return (
      filter === gl.NEAREST_MIPMAP_NEAREST ||
      filter === gl.NEAREST_MIPMAP_LINEAR ||
      filter === gl.LINEAR_MIPMAP_NEAREST ||
      filter === gl.LINEAR_MIPMAP_LINEAR
    )
  }

  /** 某个 filter 所属的"非 mipmap 等价 filter"（降级用） */
  private stripMipmap(filter: GLenum, gl: WebGLRenderingContext): GLenum {
    switch (filter) {
      case gl.NEAREST_MIPMAP_NEAREST:
      case gl.NEAREST_MIPMAP_LINEAR:
        return gl.NEAREST
      case gl.LINEAR_MIPMAP_NEAREST:
      case gl.LINEAR_MIPMAP_LINEAR:
        return gl.LINEAR
      default:
        return filter
    }
  }

  /** 某个 filter 是否包含"层内 linear 插值" */
  private hasIntraLevelLinear(filter: GLenum, gl: WebGLRenderingContext): boolean {
    return (
      filter === gl.LINEAR ||
      filter === gl.LINEAR_MIPMAP_NEAREST ||
      filter === gl.LINEAR_MIPMAP_LINEAR
    )
  }

  /** 某个 filter 是否包含"跨层 linear 插值"（即"三线性"的层间那部分） */
  private hasInterLevelLinear(filter: GLenum, gl: WebGLRenderingContext): boolean {
    return filter === gl.NEAREST_MIPMAP_LINEAR || filter === gl.LINEAR_MIPMAP_LINEAR
  }

  // ============================================================
  //  Dispose
  // ============================================================

  // 清理资源
  dispose(): void {
    const gl = this.gl

    // 删除还属于 FBO 的纹理（已 release 的 textures[i] = null 不会再删）
    for (const texture of this.textures) {
      if (texture) gl.deleteTexture(texture)
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
