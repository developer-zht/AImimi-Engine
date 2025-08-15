import { getShaderString } from '@/loaders/loadShader'
import { TRSTransform } from '@/objects/Mesh'
import { Shader } from '@/shaders/Shader'
import { ShaderParameters } from '@/types/Shader'
import { mat4 } from 'gl-matrix'

export class HDRCubeMapTexture {
  // 单例模式
  private static instance: HDRCubeMapTexture

  private gl: WebGLRenderingContext
  public envCubemap: WebGLTexture | null = null

  // 工具立方体，专门用于捕获环境贴图
  private cubeVBO: WebGLBuffer | null = null

  // Framebuffer 属性
  private conversionFBO: WebGLFramebuffer | null = null
  private conversionRBO: WebGLRenderbuffer | null = null

  // Shaders
  private equirectToCubemapShader: Shader
  // private irradianceShader: Shader
  // private prefilterMap: Shader
  // private brdfLUT:Shader

  private constructor(gl: WebGLRenderingContext) {
    this.gl = gl
  }

  public static getInstance(gl: WebGLRenderingContext) {
    if (!this.instance) {
      this.instance = new HDRCubeMapTexture(gl)
      return this.instance
    } else {
      return this.instance
    }
  }

  async init(hdrTexture: WebGLTexture, resolution: number = 512) {
    console.time('🟠 IBL Precomputation')

    // 设置 IBL Framebuffer
    console.log('🟠 Setup IBL Framebuffer...')
    this.setupIBLFramebuffer(resolution)

    // 加载 shaders
    console.log('🟠 Load IBL Shaders...')
    await this.loadShaders()

    // 计算环境 cubemap
    console.log('🟠 Converting HDR to Cubemap...')
    this.envCubemap = this.convertHDRToCubemap(hdrTexture, resolution)

    // 计算辐照度图
    // console.log('🟠 Computing irradiance map...')
    // this.irradianceMap = await this.computeIrradianceMap(this.envCubemap)

    // 预过滤环境贴图
    // console.log('🟠 Prefiltering environment map...')
    // this.prefilterMap = await this.prefilterEnvironmentMap(this.envCubemap)

    // 计算BRDF LUT
    // console.log('🟠 Computing BRDF LUT...')
    // this.brdfLUT = await this.computeBRDFLUT()

    console.timeEnd('🟠 IBL Precomputation')

    console.log('✅ 🟠 IBL initialization complete!')
  }

  /**
   * 设置用于渲染到纹理的 Framebuffer
   */
  private setupIBLFramebuffer(maxSize: number) {
    // 创建 FBO 和 RBO
    this.conversionFBO = this.gl.createFramebuffer()
    this.conversionRBO = this.gl.createRenderbuffer()

    // 绑定 FBO 和 RBO
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.conversionFBO)
    this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.conversionRBO)

    // 配置深度缓冲
    this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_COMPONENT16, maxSize, maxSize) // 实际分配显存
    this.gl.framebufferRenderbuffer(
      this.gl.FRAMEBUFFER,
      this.gl.DEPTH_ATTACHMENT,
      this.gl.RENDERBUFFER,
      this.conversionRBO
    ) // 将渲染缓冲（RBO）挂载到当前绑定的帧缓冲（FBO）的一个“附件”位置

    // 解绑 Framebuffer
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
  }

  /**
   * 加载 shaders
   */
  async loadShader(
    vertexPath: string,
    fragmentPath: string,
    shaderParams: ShaderParameters
  ): Promise<Shader | null> {
    try {
      const vertexShaderContent = await getShaderString(vertexPath)
      const fragmentShaderContent = await getShaderString(fragmentPath)

      return new Shader(this.gl, vertexShaderContent, fragmentShaderContent, shaderParams)
    } catch (error) {
      console.log(error)
      return null
    }
  }
  async loadShaders() {
    // 设不设置 shaderParams 对 IBL 渲染没影响
    const shaderParams: ShaderParameters = {
      attribs: ['aVertexPosition'],
      uniforms: ['uViewMatrix', 'uModelMatrix', 'uProjectionMatrix']
    }
    try {
      this.equirectToCubemapShader = await this.loadShader(
        'src/shaders/IBLShader/equirectToCubemapShader/EquirectToCubemapVertex.glsl',
        'src/shaders/IBLShader/equirectToCubemapShader/EquirectToCubemapFragment.glsl',
        shaderParams
      )

      // this.irradianceShader = await this.loadShader(
      //   'src/shaders/IBLShader/irradianceShader/IrradianceVertex.glsl',
      //   'src/shaders/IBLShader/irradianceShader/IrradianceFragment.glsl',
      //   shaderParams
      // )
    } catch (error) {
      console.log(error)
    }
  }

  /**
   * 将 Equirectangular HDR 贴图转换为 Cubemap
   */
  private convertHDRToCubemap(hdrTexture: WebGLTexture, resolution: number): WebGLTexture {
    // 创建 Cubemap 纹理
    const cubemap = this.gl.createTexture()
    if (!cubemap) {
      throw new Error('❌ Failed to create WebGL texture')
    }
    this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, cubemap)

    // 为 6 个面分配内存
    for (let i = 0; i < 6; i++) {
      this.gl.texImage2D(
        this.gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
        0,
        this.gl.RGB,
        resolution,
        resolution,
        0,
        this.gl.RGB,
        this.gl.FLOAT,
        null
      )
    }

    // 设置纹理参数
    this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(
      this.gl.TEXTURE_CUBE_MAP,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR_MIPMAP_LINEAR
    )
    this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)

    /**
     * MVP Matrices
     * 特殊的"捕获相机" （非场景相机）Project Matrix
     * - 90度FOV：确保每个面捕获正好1/6的环境
     * - 宽高比1.0：因为cubemap每个面是正方形
     * - 近远平面：包围渲染的立方体
     */
    const captureProjectionMatrix = mat4.perspective(mat4.create(), Math.PI / 2, 1, 0.1, 10)
    const captureViewMatrices = this.getCaptureViewMatrices()
    const captureModelMatrix = this.getCaptureModelMatrix()

    // 开始渲染 FBO
    this.gl.viewport(0, 0, resolution, resolution)
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.conversionFBO)

    for (let i = 0; i < 6; i++) {
      // 将 cubemap 的 TEXTURE_CUBE_MAP_POSITIVE_X + i 面 bind 到当前的 FRAMEBUFFER 的 COLOR_ATTACHMENT0
      this.gl.framebufferTexture2D(
        this.gl.FRAMEBUFFER,
        this.gl.COLOR_ATTACHMENT0,
        this.gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
        cubemap,
        0
      )

      /**
       * gl.clear() 放在 gl.framebufferTexture2D() ​​之后​​是出于​​绑定关系​​和​​渲染流程​​的合理设计
       * 在绑定完成前​​，帧缓冲区的目标附件是未确定的，此时调用 gl.clear() 可能无效，因为不清楚要清除的是哪个缓冲区
       * 在绑定完成后​​，gl.clear() 明确作用于当前绑定的帧缓冲区及其关联的立方体贴图面
       */
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT)

      // 使用 equirectangular 转 cubemap 的 shader
      this.equirectToCubemapShader.use()
      this.equirectToCubemapShader.setMat4('uModelMatrix', captureModelMatrix)
      this.equirectToCubemapShader.setMat4('uViewMatrix', captureViewMatrices[i])
      this.equirectToCubemapShader.setMat4('uProjectionMatrix', captureProjectionMatrix)
      this.equirectToCubemapShader.setTexture2D('uEquirectangularMap', hdrTexture, 0)

      // 渲染立方体
      this.renderCube()
    }

    // 生成 mipmap
    this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, cubemap)
    this.gl.generateMipmap(this.gl.TEXTURE_CUBE_MAP)

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)

    return cubemap
  }

  // Render （工具） Cube
  private renderCube() {
    if (!this.cubeVBO) {
      this.cubeVBO = this.createCubeVBO()
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.cubeVBO)

    const positionLocation = this.equirectToCubemapShader.getAtrributeLocation('aVertexPosition')
    if (positionLocation === -1) {
      console.log(`❌ Attribute '${name}' not found in shader`)
      return
    }
    this.gl.enableVertexAttribArray(positionLocation)
    this.gl.vertexAttribPointer(positionLocation, 3, this.gl.FLOAT, false, 0, 0)

    // 绘制
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 36)

    // 清理
    this.gl.disableVertexAttribArray(positionLocation)
  }

  // （工具） Cube 的 Vertices
  private createCubeVBO(): WebGLBuffer {
    // 36个顶点，每个面6个顶点
    const vertices = new Float32Array([
      // Right face (+X)
      1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0,
      1.0,

      // Left face (-X)
      -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0,
      1.0, 1.0,

      // Top face (+Y)
      -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0,
      -1.0,

      // Bottom face (-Y)
      -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0,
      -1.0, -1.0,

      // Front face (+Z)
      -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0,
      1.0,

      // Back face (-Z)
      -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0, -1.0,
      -1.0, -1.0
    ])

    const vbo = this.gl.createBuffer()
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW)

    return vbo
  }

  // 返回 View Matrix
  private getCaptureViewMatrices() {
    // 返回 capture camera View matrix
    return [
      // 右手系：forward × up = right
      // +X: 看向右边，头朝下（因为Cubemap Y轴是反的）
      mat4.lookAt(mat4.create(), [0, 0, 0], [1, 0, 0], [0, -1, 0]),

      // -X: 看向左边，头朝下
      mat4.lookAt(mat4.create(), [0, 0, 0], [-1, 0, 0], [0, -1, 0]),

      // +Y: 看向上方，头朝方
      mat4.lookAt(mat4.create(), [0, 0, 0], [0, 1, 0], [0, 0, 1]),

      // -Y: 看向下方，头朝前
      mat4.lookAt(mat4.create(), [0, 0, 0], [0, -1, 0], [0, 0, -1]),

      // +Z: 看向后方，头朝下
      mat4.lookAt(mat4.create(), [0, 0, 0], [0, 0, 1], [0, -1, 0]),

      // -Z: 看向前方，头朝下
      mat4.lookAt(mat4.create(), [0, 0, 0], [0, 0, -1], [0, -1, 0])
    ]
  }
  // 返回 Model Matrix
  private getCaptureModelMatrix(transform: TRSTransform = new TRSTransform()) {
    let modelMatrix = mat4.create()
    // Model transform
    mat4.identity(modelMatrix)
    mat4.translate(modelMatrix, modelMatrix, transform.translate)
    mat4.scale(modelMatrix, modelMatrix, transform.scale)
    mat4.rotateX(modelMatrix, modelMatrix, transform.rotate[0])
    mat4.rotateY(modelMatrix, modelMatrix, transform.rotate[1])
    mat4.rotateZ(modelMatrix, modelMatrix, transform.rotate[2])

    return modelMatrix
  }
}
