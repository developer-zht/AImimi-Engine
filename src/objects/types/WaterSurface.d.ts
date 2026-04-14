import { AttributeData } from './Mesh'

export interface GridMeshData {
  posData: AttributeData
  normData: AttributeData
  texCoordsData: AttributeData

  indices: number[]
}
