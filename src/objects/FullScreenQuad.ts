import { Mesh } from './Mesh'
import { Transform } from './utils/Transform'

/**
 * @param depth 深度值
 *
 * @remark
 * depth 的范围是 [-1,1]，为 NDC 坐标
 * 经过 viewport 之后，转换成
 * depth_buffer
 * = (NDC_z + 1) / 2 × (f - n) + n
 * = (NDC_z + 1) / 2 // 默认情况
 *
 * @example
 * new FullScreenQuad(gl) => 独占场景
 * z=0 -> NDC z=0 -> depth buffer=0.5 -> 在中间深度
 *
 * @example
 * new FullScreenQuad(gl, 1) => 背景
 * z=1 -> NDC z=1 -> depth buffer=1.0 -> 在最远处
 *
 * @example
 * new FullScreenQuad(gl, -1) => z=-1，最近处（覆盖一切）
 */
export class FullScreenQuad extends Mesh {
  constructor(gl: WebGLRenderingContext, label: string, depth: number = 0) {
    // 两个三角形覆盖整个 NDC [-1, 1]
    const positions = new Float32Array([-1, -1, depth, 1, -1, depth, 1, 1, depth, -1, 1, depth])
    const texCoords = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])
    const indices = [0, 1, 2, 0, 2, 3]

    super(
      [
        {
          name: 'aVertexPosition',
          array: positions,
          size: 3,
          type: gl.FLOAT
        },
        { name: 'aTextureCoord', array: texCoords, size: 2, type: gl.FLOAT }
      ],
      indices,
      new Transform([0, 0, 0], [0, 0, 0], [1, 1, 1]),
      label,
      gl
    )
  }

  // 绘制行为 draw() 不应出现在以管理数据为核心的 Mesh 中
  // /** 绑定 VBO + 绘制（blit/后处理场景的快捷方法） */
  // draw() {
  //   const gl = this.gl
  //   this.bind(gl)
  //   gl.drawElements(gl.TRIANGLES, this.count, this.indexData!.type, 0)
  // }
}
