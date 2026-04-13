import { Mesh } from '@/objects/Mesh'
import { AttributeData } from '@/objects/types/Mesh'
import { TransformationParams } from '@/objects/types/transformation'

export class SkyboxMesh extends Mesh {
  constructor(transform: TransformationParams) {
    const skyboxVertices: number[] = [
      -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, -1.0,
      1.0, -1.0,

      -1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0,
      -1.0, 1.0,

      1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, -1.0,
      -1.0,

      -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0,
      1.0,

      -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0,
      -1.0,

      -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0,
      -1.0, 1.0
    ]
    const verticesAttrib: AttributeData = {
      name: 'aVertexPosition',
      array: new Float32Array(skyboxVertices),
      size: 3
    }
    const skyboxIndices: number[] = []
    for (let i = 0; i < 36; i += 6) {
      // 每个面的两个三角形
      skyboxIndices.push(
        i,
        i + 1,
        i + 2, // 第一个三角形
        i + 3,
        i + 4,
        i + 5 // 第二个三角形
      )
    }
    super([verticesAttrib], skyboxIndices, transform)
  }
}
