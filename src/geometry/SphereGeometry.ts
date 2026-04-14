import { GeometryData } from './types/GeometryData'

export class SphereGeometry {
  /**
   * 生成 UV 球体几何数据
   *
   * @param stacks 纬度分段数（南北方向切几刀），越大越圆滑
   * @param sectors 经度分段数（绕一圈切几刀），越大越圆滑
   * @returns GeometryData（positions + normals + indices）
   */
  static create(stacks: number = 16, sectors: number = 32): GeometryData {
    const positions: number[] = []
    const normals: number[] = []
    const indices: number[] = []

    for (let i = 0; i <= stacks; i++) {
      const phi = (Math.PI / stacks) * i
      const sinPhi = Math.sin(phi)
      const cosPhi = Math.cos(phi)

      for (let j = 0; j <= sectors; j++) {
        // θ: 从 0 到 2π（绕一圈）
        const theta = ((2 * Math.PI) / stacks) * j
        const sinTheta = Math.sin(theta)
        const cosTheta = Math.cos(theta)

        const x = sinPhi * cosTheta
        const y = cosPhi
        const z = sinPhi * sinTheta

        // 单位球，position 就是 normal
        positions.push(x, y, z)
        normals.push(x, y, z)
      }
    }

    // ---- 生成索引 ----
    //
    //  i行j列的顶点 ── i行(j+1)列
    //      │  ╲            │
    //      │    ╲          │
    //  (i+1)行j列 ── (i+1)行(j+1)列
    //
    //  每个格子 → 2 个三角形

    const verticesPerRow = sectors + 1

    for (let i = 0; i < stacks; i++) {
      for (let j = 0; j < sectors; j++) {
        const topLeft = i * verticesPerRow + j
        const topRight = topLeft + 1
        const bottomLeft = (i + 1) * verticesPerRow + j
        const bottomRight = bottomLeft + 1

        // 北极那一圈只需要下三角（上面三个点重合于极点）
        if (i !== 0) {
          indices.push(topLeft, bottomLeft, topRight)
        }
        // 南极那一圈只需要上三角
        if (i !== stacks - 1) {
          indices.push(topRight, bottomLeft, bottomRight)
        }
      }
    }

    return {
      attributes: [
        {
          name: 'aVertexPosition',
          array: new Float32Array(positions),
          size: 3,
          type: WebGLRenderingContext.FLOAT
        },
        {
          name: 'aNormalPosition',
          array: new Float32Array(normals),
          size: 3,
          type: WebGLRenderingContext.FLOAT
        }
      ],
      indices
    }
  }
}
