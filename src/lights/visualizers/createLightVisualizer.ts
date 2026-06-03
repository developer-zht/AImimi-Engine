import { Mesh } from '@/objects/Mesh'
import { Transform } from '@/objects/utils/Transform'
import { Shader } from '@/shaders/Shader'
import { MeshRenderer } from '@/renderers/MeshRenderer'
import { ILight } from '../types/light'
import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { DirectionalLight } from '../directionalLight/DirectionalLight-refactor'
import { EmissiveMaterial } from '@/materials/lights/EmissiveMaterial'

// 创建光源本身，也就是画光源小方块，并不创建光源产生的效果，光源产生的效果需要在每个场景中单独配置
export async function createLightVisualizer(
  gl: WebGLRenderingContext,
  light: ILight
): Promise<MeshRenderer> {
  if (light.type === 'directional') {
    // Mesh: worldSize × worldSize × worldSize 小立方体
    const halfSize = (light as DirectionalLight).worldSize / 2
    const transform = new Transform(light.position, [0, 0, 0], [halfSize, halfSize, halfSize]) // 不要忘记 cube 的大小是 2 x 2 x 2，因此缩放成 worldSize 只需 worldSize / 2
    const mesh = Mesh.cube(transform, gl)

    // Material: 只有 uLightRadiance
    const material = new EmissiveMaterial(light.radiance)

    // Shader: 内嵌的 LightCube shader
    const shader = await Shader.createShader(
      gl,
      ShaderPaths.LIGHT_GIZMO_VERTEX,
      ShaderPaths.LIGHT_GIZMO_FRAGMENT
    )

    return new MeshRenderer(gl, mesh, material, shader, 'DirectionalLightVisualizer')
  }

  if (light.type === 'point') {
    // PointLight 可能想用球体、或者更小的方块、甚至不同的 shader
    const transform = new Transform(light.position, [0, 0, 0], [0.05, 0.05, 0.05])
    const mesh = Mesh.cube(transform, gl) // 以后可以换成 Mesh.sphere()
    const material = new EmissiveMaterial(light.radiance)
    const shader = await Shader.createShader(
      gl,
      ShaderPaths.LIGHT_GIZMO_VERTEX, // 当前碰巧和 directional 相同
      ShaderPaths.LIGHT_GIZMO_FRAGMENT
    )
    return new MeshRenderer(gl, mesh, material, shader, 'PointLightVisualizer')
  }

  throw new Error(`Unknown light type: ${light.type}`)
}
