import { Shader } from '@/shaders/Shader-refactor'
import { mat4, quat } from 'gl-matrix'
import { WebGLExtensionError } from '@/errors/EngineError/WebGLError/WebGLExtensionError'
import { Transform } from './utils/Transform'
import { MeshValidationError } from '@/errors/EngineError/MeshError/MeshValidationError'
import { CubeGeometry } from '@/geometry/CubeGeometry'
import { MeshLocationCacheError } from '@/errors/EngineError/MeshError/MeshLocationCacheError'
import { MeshVBOCreationError } from '@/errors/EngineError/MeshError/MeshVBOCreationError'
import { SphereGeometry } from '@/geometry/SphereGeometry'
import { AttributeData, IndexData, TypedArrayType } from './types/Mesh'

// ============================================================
//  Mesh 类（管理几何数据、VBO、attribute locations）
// ============================================================
export class Mesh {
  static idCount = 0 // 当前 Mesh 对象的编号计数器，保证 id 和 name 的唯一性
  private id: number // 当前 Mesh 对象的编号，保证 name 的唯一性

  protected gl: WebGLRenderingContext

  public readonly name: string

  public readonly attributes: Map<string, AttributeData> = new Map()
  public readonly indexData: IndexData | null

  private _transform: Transform

  // Mesh 自己管理 VBO
  private vbos: Map<string, WebGLBuffer> = new Map()
  private ibo: WebGLBuffer | null = null

  // Mesh 自己缓存 attribute locations
  private locationCache: Map<string, number> = new Map()

  constructor(
    attributes: AttributeData[],
    rawIndices: number[] | null,
    transform: Transform,
    name: string,
    gl: WebGLRenderingContext
  ) {
    // 对传入数据的进行检查
    if (attributes.length === 0) {
      throw new MeshValidationError('empty_attribute', 'No attributes provided', name)
    }

    // 此处硬编码了三角形的假设，但 Mesh 不应该知道自己会被怎么画。比如 Axis Mesh 总共有 3 个轴，每个轴 2 个点，每个点对应 1 个 index，一共 6 个 index，但这仅是恰巧能被 3 整除。因此，对 rawIndices.length 的检查不应放在 Mesh 的构造函数中， Mesh 不应该知道自己会被怎么画。
    // if (rawIndices.length % 3 !== 0) {
    //   throw new MeshValidationError(
    //     'invalid_index_count',
    //     `Index count (${rawIndices.length}) is not a multiple of 3`,
    //     name
    //   )
    // }

    this.id = Mesh.idCount++ // 与 C++ 一致，等价于 this.id = Mesh.idCount & Mesh.idCount++

    this.gl = gl

    for (const attri of attributes) {
      this.attributes.set(attri.name, attri)
    }

    // 索引可选
    this.indexData =
      rawIndices && rawIndices.length > 0 ? Mesh.chooseIndexType(rawIndices, gl) : null

    this._transform = transform

    // 如果未来打包后 Mesh 这个类名变成了 a 怎么办？那 name 是不是也就跟着变成了 a ？
    // this.name = this.constructor.name
    this.name = `${name}#${this.id}`
  }
  /**
   * 一个纯粹的数据转换工具
   *
   * 将普通的 number[] 转换为 {@linkcode IndexData | 索引缓冲数据类型}。
   * 该函数不涉及 GPU 操作，仅进行数据结构转换。
   */
  private static chooseIndexType(indices: number[], gl: WebGLRenderingContext): IndexData {
    // 使用 ... 展开运算符时，在 V8 里，大致会做：
    // 1. 创建一个 arguments list
    // 2. 遍历 indices
    // 3. 把每个元素“放进调用栈参数区”
    // 因此，当 indices 元素太多时会造成 RangeError: Maximum call stack size exceeded 错误
    // const maxIndex = Math.max(...indices)

    let maxIndex = -Infinity
    for (let i = 0; i < indices.length; i++) {
      if (indices[i]! > maxIndex) {
        maxIndex = indices[i]!
      }
    }

    if (maxIndex < 256) {
      return { array: new Uint8Array(indices), type: WebGLRenderingContext.UNSIGNED_BYTE }
    }
    if (maxIndex < 65536) {
      return { array: new Uint16Array(indices), type: WebGLRenderingContext.UNSIGNED_SHORT }
    }

    if (gl) {
      const ext = gl.getExtension('OES_element_index_uint')
      if (!ext) throw new WebGLExtensionError('OES_element_index_uint')
    }

    return {
      array: new Uint32Array(indices),
      type: WebGLRenderingContext.UNSIGNED_INT
    }
  }

  /**
   * 创建 VBO（由 Mesh 负责），并写入数据
   *
   * 仅负责分配并填充缓冲区数据，
   * 不会配置 attribute pointer 或定义数据读取方式。
   * attribute 的绑定与启用由 bind() 阶段完成。
   */
  createVBOs(gl: WebGLRenderingContext, dynamic: boolean = false): void {
    const usage = dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW

    // 临时 Map：array 对象引用 → 已创建的 VBO
    // 用来检测多个 attribute 是否共享同一份数据
    const uploadedArrays = new Map<TypedArrayType, WebGLBuffer>()

    // 创建 attribute buffers
    for (const [name, attriData] of this.attributes) {
      let vbo: WebGLBuffer

      if (uploadedArrays.has(attriData.array)) {
        // 这份数据已经上传过，直接复用同一个 VBO
        vbo = uploadedArrays.get(attriData.array)!
      } else {
        // 第一次见到这份数据，创建新 VBO 并上传
        vbo = gl.createBuffer()
        if (!vbo) {
          throw new MeshVBOCreationError('vbo', `Failed to create VBO for '${name}'`, this.name, {
            attributeName: name
          })
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
        gl.bufferData(gl.ARRAY_BUFFER, attriData.array, usage)
        uploadedArrays.set(attriData.array, vbo)
      }

      this.vbos.set(name, vbo)
    }

    // 索引缓冲 index buffer 仅在有索引时创建
    if (this.indexData) {
      this.ibo = gl.createBuffer()
      if (!this.ibo) {
        throw new MeshVBOCreationError('ibo', `Failed to create VBO for ${this.name}`, this.name)
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indexData.array, gl.STATIC_DRAW)
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
  }

  /**
   * 缓存 attribute locations（由 Mesh 负责）
   *
   * 仅进行 attribute 名称到 location 的映射查询，
   * 不涉及缓冲区数据的上传或绑定。
   */
  cacheAttriLocations(shader: Shader): void {
    this.locationCache.clear()

    for (const name of this.attributes.keys()) {
      const location = shader.getAttribLocation(name)
      if (location >= 0) {
        this.locationCache.set(name, location)
      } else {
        console.warn(
          new MeshLocationCacheError(
            name,
            `Attribute '${name}' not found in '${shader.name}' shader program`,
            this.name,
            {
              shaderProgramName: shader.name
            }
          )
        )
      }
    }
  }

  /**
   * 获取 attribute location（从缓存）
   *
   * 配置 attribute pointer 并启用 attribute，
   * 指定 GPU 如何解释已上传的缓冲区数据。
   *
   * 不会执行数据上传操作。
   */
  getAttriLocation(name: string): number | undefined {
    return this.locationCache.get(name)
  }

  /**
   * 绑定几何数据（由 Mesh 负责）
   */
  bind(gl: WebGLRenderingContext) {
    // console.debug(this.vbos.size)
    // console.debug(this.locationCache.size)

    for (const [name, vbo] of this.vbos) {
      const location = this.getAttriLocation(name)
      if (location === undefined || location < 0) continue

      const attriData = this.attributes.get(name)
      if (!attriData) {
        throw new MeshValidationError(
          'empty_attribute',
          `VBO exists for attribute '${name}' but AttributeData is missing`,
          this.constructor.name
        )
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
      gl.vertexAttribPointer(
        location,
        attriData.size,
        attriData.type,
        attriData.normalized ?? false,
        attriData.stride ?? 0,
        attriData.offset ?? 0
      )
      gl.enableVertexAttribArray(location)
    }

    // 绑定索引
    if (this.ibo) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo)
    }
  }

  /**
   * 获取 Model 矩阵
   */
  getModelMatrix(): mat4 {
    const matrix = mat4.create()
    mat4.identity(matrix)

    const q = quat.create()
    quat.identity(q) // 显式设为单位四元数（create() 已经是这个值，这行多余）

    // gl-matrix 提供了从欧拉角直接创建四元数的方法
    quat.fromEuler(
      q,
      this._transform.rotation[0] * (180 / Math.PI), // fromEuler 接受角度，不是弧度
      this._transform.rotation[1] * (180 / Math.PI),
      this._transform.rotation[2] * (180 / Math.PI)
    )

    /**
     * transform.rotate 存的是欧拉角（XYZ 三个独立角度），
     * 把它们分别转成四元数再合并。
     * 这样做绕了一个大圈，但并没有解决欧拉角的本质问题（万向节死锁），只是换了一种计算方式，
     * 结果完全等价于直接用欧拉角。
     */
    // const qx = quat.create()
    // const qy = quat.create()
    // const qz = quat.create()
    // quat.setAxisAngle(qx, [1, 0, 0], this.transform.rotate[0])
    // quat.setAxisAngle(qy, [0, 1, 0], this.transform.rotate[1])
    // quat.setAxisAngle(qz, [0, 0, 1], this.transform.rotate[2])
    // 顺序非常重要（和原来的 rotateX/Y/Z 一致）
    // quat.multiply(q, q, qx)
    // quat.multiply(q, q, qy)
    // quat.multiply(q, q, qz)
    // mat4.fromQuat(matrix, q)

    // mat4.translate(matrix, matrix, this.transform.translate)
    // mat4.scale(matrix, matrix, this.transform.scale)
    // mat4.rotateX(matrix, matrix, this.transform.rotate[0])
    // mat4.rotateY(matrix, matrix, this.transform.rotate[1])
    // mat4.rotateZ(matrix, matrix, this.transform.rotate[2])

    mat4.fromRotationTranslationScale(matrix, q, this._transform.translation, this._transform.scale)

    return matrix
  }

  // 修改 translate
  setTranslation(x: number, y: number, z: number): void {
    this._transform.setTranslation([x, y, z])
  }

  // 修改 scale
  setScale(x: number, y: number, z: number): void {
    this._transform.setScale([x, y, z])
  }

  // 修改 rotate（弧度）
  setRotation(x: number, y: number, z: number): void {
    this._transform.setRotation([x, y, z])
  }

  get transform(): Transform {
    return this._transform
  }

  /** 是否使用索引绘制 */
  get hasIndices(): boolean {
    return this.indexData !== null
  }

  // 获取 indices 个数
  get count(): number {
    if (this.indexData) {
      return this.indexData.array.length
    }
    // 无索引时，用 aPosition 的数据长度 / itemSize 算出顶点数
    const posAttr = this.attributes.get('aPosition')
    if (posAttr) {
      return posAttr.array.length / posAttr.size
    }
    // fallback：取第一个 attribute
    const first = this.attributes.values().next().value
    return first ? first.array.length / first.size : 0
  }

  /**
   * 清理
   */
  dispose() {
    /**
     * 需要清除的属性
     *
     * private vbos: Map<string, WebGLBuffer> = new Map()
     * private ibo: WebGLBuffer | null = null
     * private locationCache: Map<string, number> = new Map()
     */
    const deletedVBOs: Set<WebGLBuffer> = new Set()
    for (const vbo of this.vbos.values()) {
      // 需要考虑多个 attribute 共享同一个 VBO（Interleaved）的情况，最好不要对同一个 VBO 调用多次 gl.deleteBuffer()
      if (!deletedVBOs.has(vbo)) {
        deletedVBOs.add(vbo)
        this.gl.deleteBuffer(vbo)
      }
    }
    if (this.ibo) {
      this.gl.deleteBuffer(this.ibo)
      this.ibo = null
    }

    this.vbos.clear()
    this.locationCache.clear()
  }

  static cube(transform: Transform, gl: WebGLRenderingContext) {
    const geometry = CubeGeometry.create()

    return new Mesh(geometry.attributes, geometry.indices, transform, 'Cube', gl)
  }

  static sphere(transform: Transform, gl: WebGLRenderingContext) {
    const geometry = SphereGeometry.create(8, 16)

    return new Mesh(geometry.attributes, geometry.indices, transform, 'Sphere', gl)
  }
}
