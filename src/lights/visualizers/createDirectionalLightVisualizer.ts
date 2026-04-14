import { Mesh } from '@/objects/Mesh'
import { ILight } from '../types/light'
import { Transform } from '@/objects/utils/Transform'

import { Shader } from '@/shaders/Shader-refactor'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { MeshRenderer } from '@/renderers/MeshRenderer'
import { registerVisualizer } from './visualizerRegistry'
import { EmissiveMaterial } from '@/materials/lights/EmissiveMaterial'

export async function createDirectionalLightVisualizer(gl: WebGLRenderingContext, light: ILight) {
  const transform = new Transform(light.position, [0, 0, 0], [0.2, 0.2, 0.2])
  const mesh = Mesh.cube(transform, gl)
  const material = new EmissiveMaterial(light.radiance)
  const shader = await Shader.createShader(
    gl,
    ShaderPaths.LIGHT_GIZMO_VERTEX,
    ShaderPaths.LIGHT_GIZMO_FRAGMENT
  )

  return new MeshRenderer(gl, mesh, material, shader, 'DirectionalLightVisualizer')
}

registerVisualizer('directional', createDirectionalLightVisualizer)
