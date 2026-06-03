import { ShaderPaths } from '@/shaders/_config/shaderPaths'
import { HW1SceneConfig } from '../types/HW1SceneConfig'
import { Transform } from '@/objects/utils/Transform'
import { hw1Light1 } from '@/lights/directionalLight/_presets/hw1Lights'
import { ModelPaths } from '@/models/_config/modelPaths'

export const HW1_SCENE_CONFIG: HW1SceneConfig = {
  cameraConfig: {
    position: [0, 30, 50],
    target: [0, 10, 0]
  },
  modelConfigs: [
    {
      path: ModelPaths.HW1_MARY,
      name: 'Marry',
      format: 'obj',
      vertShaderPath: ShaderPaths.DIRECT_LIGHT_VERTEX,
      fragShaderPath: ShaderPaths.DIRECT_LIGHT_FRAGMENT,
      transform: new Transform([0, 0, 0], [0, 0, 0], [10, 10, 10])
    },
    {
      path: ModelPaths.HW1_FLOOR,
      name: 'floor',
      format: 'obj',
      vertShaderPath: ShaderPaths.DIRECT_LIGHT_VERTEX,
      fragShaderPath: ShaderPaths.DIRECT_LIGHT_FRAGMENT,
      transform: new Transform([0, 0, 0], [0, 0, 0], [2, 2, 2])
    }
  ],
  lightConfigs: [
    {
      id: 'hw1Light',
      light: hw1Light1,
      guiConfig: {
        name: 'HW1 Light',
        positionRange: { x: [-100, 100], y: [0, 100], z: [-100, 100] },
        worldSizeRange: [0.5, 30]
      }
    }
  ]
}
