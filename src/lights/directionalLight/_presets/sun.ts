import { Vec3 } from '@/math/types/math'
import { DirectionalLight } from '../DirectionalLight-refactor'

/**
 * 由 position + direction 推导一个"很远的 target"
 *
 * 物理含义：
 *   方向光的 target 在"光传播方向上的无限远"，工程上用 1000 单位足够远即可。
 *   只要 (target - position) 与 direction 方向一致，
 *   DirectionalLight 内部 normalize(target - position) 就能还原出正确的单位方向。
 *
 * 参数：
 *   position  — 假设的"太阳位置"（visualizer / shadow ortho eye 都用这个）
 *   direction — 光传播方向 light → scene，可以不归一化
 *   distance  — target 离 position 多远，默认 1000，足以让 normalize 数值稳定
 */
function targetFromDirection(position: Vec3, direction: Vec3, distance: number = 1000): Vec3 {
  return [
    position[0] + direction[0] * distance,
    position[1] + direction[1] * distance,
    position[2] + direction[2] * distance
  ]
}

// 黎明（日出前后，太阳低角度，暖色偏红）
const DAWN_POS: Vec3 = [500, 50, 0]
const DAWN_DIR: Vec3 = [-0.98, -0.1, 0.17] // 东方低角度，光向西
export const dawnSun = new DirectionalLight({
  radiance: [5.0, 2.5, 1.2],
  position: DAWN_POS,
  target: targetFromDirection(DAWN_POS, DAWN_DIR),
  up: [0, 1, 0],
  shadowOptions: { shadowConfig: { orthoSize: 300, near: 0.1, far: 2000 } }
})

// 上午（9~10 点，黄白偏暖）
const MORNING_POS: Vec3 = [400, 400, 100]
const MORNING_DIR: Vec3 = [-0.7, -0.7, -0.17]
export const morningSun = new DirectionalLight({
  radiance: [8.0, 7.0, 5.5],
  position: MORNING_POS,
  target: targetFromDirection(MORNING_POS, MORNING_DIR),
  up: [0, 1, 0],
  shadowOptions: { shadowConfig: { orthoSize: 300, near: 0.1, far: 2000 } }
})

// 正午（高角度，最亮、近白）
const NOON_POS: Vec3 = [-200, 100, 400]
const NOON_DIR: Vec3 = [0.3, -0.2, -0.6]
// const NOON_DIR: Vec3 = [0.05, -0.95, -0.1]
export const noonSun = new DirectionalLight({
  radiance: [5.0, 4.8, 4.5],
  position: NOON_POS,
  target: targetFromDirection(NOON_POS, NOON_DIR),
  up: [1, 0, 0], // 接近垂直时需要非 Y 的 up，避免 lookAt 退化
  shadowOptions: { shadowConfig: { orthoSize: 300, near: 0.1, far: 2000 } },
  worldSize: 10
})

// 黄昏（日落前，暖橙红，低角度）
const DUSK_POS: Vec3 = [-500, 30, 0]
const DUSK_DIR: Vec3 = [0.99, -0.06, 0.1]
export const duskSun = new DirectionalLight({
  radiance: [5.0, 2.0, 1.0],
  position: DUSK_POS,
  target: targetFromDirection(DUSK_POS, DUSK_DIR),
  up: [0, 1, 0],
  shadowOptions: { shadowConfig: { orthoSize: 300, near: 0.1, far: 2000 } }
})
