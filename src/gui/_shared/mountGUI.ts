import { GUI } from 'dat.gui'
import { Pane } from 'tweakpane'

/** GUI Stack 的 DOM 容器 ID（与 index.html 中的 id 对应） */
const STACK_ID = 'gui-stack'

function getStack(): HTMLElement | null {
  const el = document.getElementById(STACK_ID)
  if (!el) console.warn(`[mountGUI] #${STACK_ID} not found in DOM`)
  return el
}

/**
 * 创建一个挂载到 #gui-stack 的 dat.GUI 实例
 *
 * 与直接 new GUI() 的区别：
 * - autoPlace: false → 不自动钉到视口右上角
 * - 手动 appendChild 到 stack → 由 stack 的 flex 布局控制位置
 *
 * 返回的 gui 仍可正常调用 addFolder / add / destroy 等 API
 */
export function mountDatGUI(): GUI {
  const stack = getStack()
  if (!stack) return new GUI()

  const gui = new GUI({ autoPlace: false })
  stack.appendChild(gui.domElement)

  return gui
}

/**
 * 卸载一个由 mountDatGUI 创建的 dat.GUI 实例
 *
 * 步骤：
 * 1. element.remove() 把 DOM 节点从其 parent 移除
 *    （比 stack.removeChild 更鲁棒：不假设挂在哪）
 * 2. gui.destroy() 清理 dat.GUI 内部状态（resize listener 等）
 *
 * 两步缺一不可：
 * - 只 remove DOM → listener 泄漏
 * - 只 destroy → DOM 节点残留（dat.GUI 在 autoPlace:false 时 destroy 不会自动 detach）
 */
export function unmountDatGUI(gui: GUI): void {
  gui.domElement.remove()
  gui.destroy()
}

/**
 * 创建一个挂载到 #gui-stack 的 Tweakpane 实例
 *
 * 与直接 new Pane() 的区别：
 * - container: stack → Pane 直接挂载到我们的 #gui-stack 容器
 *   （Tweakpane 原生支持 container 参数，比 dat.GUI 优雅，不需要 autoPlace:false hack）
 * - 没有 #gui-stack 时 → container: undefined 让 Tweakpane fallback 到 auto-place
 *
 * 返回的 pane 仍可正常调用 addFolder / addBinding / addButton 等 API
 */
export function mountPane(title?: string): Pane {
  const stack = getStack()
  return new Pane({
    title,
    container: stack ?? undefined // 没有 stack 时 fallback 到 auto-place
  })
}

/**
 * 卸载一个由 mountPane 创建的 Tweakpane 实例
 *
 * 步骤：
 * 1. element.remove() 把 DOM 节点从其 parent 移除
 *    （和 unmountDatGUI 同理，不假设挂在哪）
 * 2. pane.dispose() 清理 Tweakpane 内部状态（事件监听、controller 引用等）
 *
 * 两步缺一不可：
 * - 只 remove DOM → 内部 controller / listener 泄漏（dispose 才会清）
 * - 只 dispose → DOM 节点残留
 *   （源码佐证：Pane.dispose() 内部只在 `usesDefaultWrapper_` 为 true 时
 *    才 removeChild，而我们传了 container，该值为 false，dispose 不会 detach）
 */
export function unmountPane(pane: Pane): void {
  pane.element.remove()
  pane.dispose()
}
