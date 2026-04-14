import { DirectionalLight } from '../DirectionalLight-refactor'

// cave scene 灯光参数
export const hw4Light = new DirectionalLight({
  radiance: [10, 10, 10],
  position: [60, 20, 30],
  direction: [0, 0, -1],
  up: [0, 1, 0],
  worldSize: 1,
  shadowOptions: { shadowConfig: { orthoSize: 100, near: 0.1, far: 300 } }
})
