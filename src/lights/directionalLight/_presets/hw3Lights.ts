import { DirectionalLight } from '../DirectionalLight-refactor'

// cave scene 灯光参数
export const hw3GbufferPassLight = new DirectionalLight({
  radiance: [20, 20, 20],
  position: [-0.45, 25.40507, 0.637043],
  target: [-0.840498811, 6.30403828, 0.43861147],
  up: [0, 1, 0],
  worldSize: 1,
  shadowOptions: { shadowConfig: { orthoSize: 100, near: 0.1, far: 300 } }
})
