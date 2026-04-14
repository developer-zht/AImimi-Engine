import { DirectionalLight } from '../DirectionalLight-refactor'

// hw1 灯光参数
export const hw1Light1 = new DirectionalLight({
  radiance: [3, 3, 3],
  position: [0, 80, 80],
  target: [0, 0, 0],
  up: [0, 1, 0],
  worldSize: 5,
  shadowOptions: { shadowConfig: { orthoSize: 100, near: 0.1, far: 300 } }
})

export const hw1CaveLight = new DirectionalLight({
  radiance: [3, 3, 3],
  position: [0, 80, 0],
  target: [0, 0, 0],
  up: [0, 1, 0],
  shadowOptions: { shadowConfig: { orthoSize: 100, near: 0.1, far: 300 } }
})
