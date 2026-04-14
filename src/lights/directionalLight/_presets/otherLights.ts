import { DirectionalLight } from '../DirectionalLight-refactor'

// 正午太阳（从正上方偏南打下来，白色强光）
export const noonSun = new DirectionalLight({
  radiance: [10, 10, 10],
  position: [0, 100, 50],
  target: [0, 0, 0], // 指向原点
  shadowOptions: { shadowConfig: { orthoSize: 100, near: 0.1, far: 300 } }
  // up 省略，默认 [0, 1, 0]
})

// 夕阳（低角度暖光）
export const sunsetLight = new DirectionalLight({
  radiance: [8, 4, 2],
  position: [200, 30, 0],
  target: [0, 0, 0],
  shadowOptions: { shadowConfig: { orthoSize: 150, near: 0.1, far: 500 } }
})

// 室内补光（弱白光，从侧上方）
export const fillLight = new DirectionalLight({
  radiance: [2, 2, 2],
  position: [50, 80, 50],
  target: [0, 0, 0],
  shadowOptions: { castShadow: false }
})

// 月光（冷色弱光）
export const moonLight = new DirectionalLight({
  radiance: [0.5, 0.6, 1.0],
  position: [0, 120, -80],
  target: [0, 0, 0],
  up: [1, 0, 0],
  shadowOptions: { shadowConfig: { orthoSize: 200, near: 1, far: 400 } }
})
