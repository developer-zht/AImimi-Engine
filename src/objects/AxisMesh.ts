import { TransformationParams } from '@/objects/types/transformation'
import { Mesh } from '@/objects/Mesh'
import { AttributeData } from '@/objects/types/Mesh'

export class AxisMesh extends Mesh {
  constructor(transform: TransformationParams) {
    const axisVertices = [
      // X轴
      0.0, 0.0, 0.0, 1.0, 0.0, 0.0,
      // Y轴
      0.0, 0.0, 0.0, 0.0, 1.0, 0.0,
      // Z轴
      0.0, 0.0, 0.0, 0.0, 0.0, 1.0
    ]

    const colors = [
      1.0,
      0.0,
      0.0,
      1.0,
      0.0,
      0.0, // X轴红色
      0.0,
      1.0,
      0.0,
      0.0,
      1.0,
      0.0, // Y轴绿色
      0.0,
      0.0,
      1.0,
      0.0,
      0.0,
      1.0 // Z轴蓝色
    ]

    const indices: number[] = [0, 1, 2, 3, 4, 5]

    const verticesAttrib: AttributeData = {
      name: 'aVertexPosition',
      array: new Float32Array(axisVertices),
      size: 3
    }

    const colorsAttrib: AttributeData = {
      name: 'aColor',
      array: new Float32Array(colors),
      size: 3
    }

    super([verticesAttrib, colorsAttrib], indices, transform)
  }
}
