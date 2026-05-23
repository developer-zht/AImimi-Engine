import { DirectionalLight } from '../DirectionalLight-refactor'

// 夜晚（月光，冷蓝，低强度）
export const nightMoon = new DirectionalLight({
  radiance: [0.1, 0.15, 0.3],
  position: [200, 300, 200],
  direction: [-0.5, -0.7, -0.5],
  up: [0, 1, 0],
  shadowOptions: { shadowConfig: { orthoSize: 300, near: 0.1, far: 2000 } }
})
