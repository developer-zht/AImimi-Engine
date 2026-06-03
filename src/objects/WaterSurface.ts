import { Mesh } from '@/objects/Mesh'
import { Transform } from './utils/Transform'
import { generateGridMeshData } from './utils/generateGridMeshData'

// FIXME:水面通常需要动态更新顶点数据（如波浪动画），需要考虑：
// - 是否需要 `gl.DYNAMIC_DRAW` 而不是 `gl.STATIC_DRAW`
// - 是否需要提供 `updateVertexData()` 方法

/**
 * 水面网格对象。
 *
 * 作用：
 * - 生成规则平面网格（Grid Mesh）
 * - 提供顶点位置、法线、UV、索引数据
 * - 交由 {@link Mesh} 负责 GPU Buffer 创建与绑定
 *
 * 特点：
 * - 初始为静态平面（Y = 0）
 * - 法线默认朝上 (0, 1, 0)
 * - UV 均匀分布
 *
 * 生命周期：
 * - 构造时生成完整顶点数据
 * - 数据上传由父类 Mesh 完成
 * - 如需动态波浪效果，应扩展 updateVertexData()
 *
 * WebGL 限制：
 * - WebGL1 默认使用 UNSIGNED_SHORT 作为索引类型
 * - 最大索引值 65535
 * - resolution^2 不能超过 65536
 * - 若需要更高分辨率，必须启用 OES_element_index_uint 扩展
 *
 * 性能建议：
 * - 静态水面：使用 gl.STATIC_DRAW
 * - 动态波浪：建议使用 gl.DYNAMIC_DRAW
 *
 * 架构位置：
 * - 几何层（Geometry Layer）
 * - 不负责材质、着色、波浪计算逻辑
 */
export class WaterSurface extends Mesh {
  /**
   * 创建水面网格。
   *
   * @param transform 模型变换参数
   * @param surfaceSize 水面物理尺寸（世界空间单位）
   * @param resolution 网格分辨率（每行/列顶点数）
   *
   * @remark
   * resolution 说明：
   * - resolution 表示“网格数量”
   * - 实际生成 (resolution + 1) × (resolution + 1) 个顶点
   * - 实际生成 resolution^2 个网格
   */

  // private size: number
  // private resolution: number

  constructor(
    gl: WebGLRenderingContext,
    transform: Transform,
    surfaceSize: number,
    resolution: number
  ) {
    const meshData = generateGridMeshData(gl, surfaceSize, resolution + 1)

    // const transform = new Transform(
    //   [transformParams.modelTransX, transformParams.modelTransY, transformParams.modelTransZ],
    //   [transformParams.modelRotateX, transformParams.modelRotateY, transformParams.modelRotateZ],
    //   [transformParams.modelScaleX, transformParams.modelScaleY, transformParams.modelScaleZ]
    // )
    super(
      [meshData.posData, meshData.normData, meshData.texCoordsData],
      meshData.indices,
      transform,
      'WaterSurface',
      gl
    )
    // this.size = size
    // this.resolution = resolution
  }
}
