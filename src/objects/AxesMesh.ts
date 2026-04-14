import { Mesh } from './Mesh'
import { AttributeData } from './types/Mesh'
import { Transform } from './utils/Transform'

export class AxesMesh extends Mesh {
  constructor(gl: WebGLRenderingContext, transform: Transform, label: string) {
    // 内联顶点数据（6 个顶点 = 3 条线段 × 2 端点）
    const positions: AttributeData = {
      name: 'aVertexPosition',
      array: new Float32Array([
        0.0,
        0.0,
        0.0,
        1.0,
        0.0,
        0.0, // X 轴
        0.0,
        0.0,
        0.0,
        0.0,
        1.0,
        0.0, // Y 轴
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        1.0 // Z 轴
      ]),
      size: 3,
      type: gl.FLOAT
    }

    const colors: AttributeData = {
      name: 'aColor',
      array: new Float32Array([
        1.0,
        0.0,
        0.0,
        1.0,
        0.0,
        0.0, // 红
        0.0,
        1.0,
        0.0,
        0.0,
        1.0,
        0.0, // 绿
        0.0,
        0.0,
        1.0,
        0.0,
        0.0,
        1.0 // 蓝
      ]),
      size: 3,
      type: gl.FLOAT
    }

    const indices = [0, 1, 2, 3, 4, 5]

    super([positions, colors], indices, transform, label, gl)
  }
}
