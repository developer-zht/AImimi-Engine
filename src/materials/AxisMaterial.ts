import { getShaderString } from '@/loaders/loadShader'
import { Material } from '@/materials/Material'

export class AxisMaterial extends Material {
  constructor(vertexShaderContent: string, fragmentShaderContent: string) {
    super({}, [], vertexShaderContent, fragmentShaderContent, null)
  }
}

export async function buildAxisMaterial(
  vertexPath: string,
  fragmentPath: string
): Promise<AxisMaterial> {
  const vertexShaderContent = await getShaderString(vertexPath)
  const fragmentShaderContent = await getShaderString(fragmentPath)

  const axisMaterial = new AxisMaterial(vertexShaderContent, fragmentShaderContent)

  return axisMaterial
}
