import { GridMeshData } from '../types/WaterSurface'

/**
 * 生成创建 Grid Mesh 所需的数据
 *
 * @param {number} gridSize grid 世界坐标系下的大小
 * @param {number} vertexCount 每行、每列有多少个 vertex
 * 由于 WebGL1.0 的限制，indices 的大小最多为 unsigned int 16 bit，也就是 65536
 * 因此 resolution 的值不能太高，否则图中的 vertex 的个数超过了 65536 的话，就会显示错误
 * 除非打开 OES_element_index_uint 扩展
 * */
export function generateGridMeshData(
  gl: WebGLRenderingContext,
  gridSize: number,
  vertexCount: number
): GridMeshData {
  // const positions: number[] = []
  // const normals: number[] = []
  // const texCoords: number[] = []

  // const indices: number[] = []

  // // 注意： < vertexCount 而不是 <= vertexCount
  // for (let i = 0; i < vertexCount; i++) {
  //   for (let j = 0; j < vertexCount; j++) {
  //     const x = (i / (vertexCount - 1) - 0.5) * gridSize
  //     const z = (j / (vertexCount - 1) - 0.5) * gridSize
  //     const u = i / (vertexCount - 1)
  //     const v = j / (vertexCount - 1)

  //     positions.push(x, 0, z)
  //     normals.push(0, 1, 0)
  //     texCoords.push(u, v)
  //   }
  // }

  // for (let i = 0; i < vertexCount - 1; i++) {
  //   for (let j = 0; j < vertexCount - 1; j++) {
  //     const topLeft = i * vertexCount + j
  //     const topRight = topLeft + 1
  //     const bottomLeft = (i + 1) * vertexCount + j
  //     const bottomRight = bottomLeft + 1

  //     indices.push(topLeft, bottomLeft, topRight)
  //     indices.push(topRight, bottomLeft, bottomRight)
  //   }
  // }

  const vertCount = vertexCount * vertexCount
  const quadCount = (vertexCount - 1) * (vertexCount - 1)

  // 一次性按精确大小分配，零 realloc、零拷贝
  const positions = new Float32Array(vertCount * 3)
  const normals = new Float32Array(vertCount * 3)
  const texCoords = new Float32Array(vertCount * 2)
  const indices = new Uint32Array(quadCount * 6)

  let pi = 0
  let ti = 0
  // 注意： < vertexCount 而不是 <= vertexCount
  for (let i = 0; i < vertexCount; i++) {
    for (let j = 0; j < vertexCount; j++) {
      const x = (i / (vertexCount - 1) - 0.5) * gridSize
      const z = (j / (vertexCount - 1) - 0.5) * gridSize
      const u = i / (vertexCount - 1)
      const v = j / (vertexCount - 1)

      positions[pi] = x
      positions[pi + 1] = 0
      positions[pi + 2] = z
      normals[pi] = 0
      normals[pi + 1] = 1
      normals[pi + 2] = 0
      pi += 3

      texCoords[ti] = u
      texCoords[ti + 1] = v
      ti += 2
    }
  }

  let ii = 0
  for (let i = 0; i < vertexCount - 1; i++) {
    for (let j = 0; j < vertexCount - 1; j++) {
      const topLeft = i * vertexCount + j
      const topRight = topLeft + 1
      const bottomLeft = (i + 1) * vertexCount + j
      const bottomRight = bottomLeft + 1

      // 顺序非常重要，必须满足一个条件：三角形的绕序（winding order）一致。
      // 因为 GPU 判断三角形正反面只看：顶点顺序是顺时针 (CW) 还是逆时针 (CCW)
      indices[ii] = topLeft
      indices[ii + 1] = bottomLeft
      indices[ii + 2] = topRight
      indices[ii + 3] = topRight
      indices[ii + 4] = bottomLeft
      indices[ii + 5] = bottomRight
      ii += 6
    }
  }

  return {
    posData: {
      name: 'aVertexPosition',
      array: new Float32Array(positions),
      size: 3,
      type: gl.FLOAT
    },
    normData: {
      name: 'aNormalPosition',
      array: new Float32Array(normals),
      size: 3,
      type: gl.FLOAT
    },
    texCoordsData: {
      name: 'aTextureCoord',
      array: new Float32Array(texCoords),
      size: 2,
      type: gl.FLOAT
    },
    indices
  }
}
