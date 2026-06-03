import { Mesh } from '@/objects/Mesh'
import { Transform } from '@/objects/utils/Transform'
import { MeshRenderer } from '@/renderers/MeshRenderer'
import { ILight } from '../types/light'

import { Shader } from '@/shaders/Shader'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { registerVisualizer } from './visualizerRegistry'
import { IPointLight } from '../pointLight/types/pointLight'
import { EmissiveMaterial } from '@/materials/lights/EmissiveMaterial'

export async function createPointLightVisualizer(
  gl: WebGLRenderingContext,
  light: ILight
): Promise<MeshRenderer> {
  const transform = new Transform(light.position, [0, 0, 0], [0.05, 0.05, 0.05])
  const mesh = Mesh.cube(transform, gl)
  const material = new EmissiveMaterial((light as IPointLight).color)
  const shader = await Shader.createShader(
    gl,
    ShaderPaths.LIGHT_GIZMO_VERTEX,
    ShaderPaths.LIGHT_GIZMO_FRAGMENT
  )

  return new MeshRenderer(gl, mesh, material, shader, 'PointLightVisualizer')
}

registerVisualizer('point', createPointLightVisualizer)
