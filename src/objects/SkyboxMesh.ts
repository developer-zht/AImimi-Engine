import { AttributeData } from '@/objects/types/Mesh'
import { Mesh } from './Mesh'
import { Transform } from './utils/Transform'

export class SkyboxMesh extends Mesh {
  constructor(
    gl: WebGLRenderingContext,
    label: string
    // 在 src/shaders/environment/converters/equirectToCubemap/fragment.frag 中进行了 Y 轴旋转，因此这里就不需要旋转网格了
    // transform: Transform = Transform.identity()
  ) {
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
    const verticesAttribs: AttributeData[] = [
      {
        name: 'aVertexPosition',
        array: new Float32Array(skyboxVertices),
        size: 3,
        type: gl.FLOAT
      }
    ]
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
    super(verticesAttribs, skyboxIndices, Transform.identity(), label, gl)
  }
}
