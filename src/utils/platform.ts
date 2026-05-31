/** iOS（含伪装成 Mac 的 iPadOS）。靠 maxTouchPoints 补 iPad UA 伪装的坑 */
export function isiOS(): boolean {
  const ua = navigator.userAgent
  const isiOS = /iPhone|iPad|iPod/i.test(ua)
  // iPadOS 13+ UA 是 "Macintosh"，但有多点触控 → 据此识别
  const isiPadOS = ua.includes('Macintosh') && navigator.maxTouchPoints > 1
  return isiOS || isiPadOS
}

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent)
}

/** 是否移动端（更稳：UA + 粗指针媒体查询，兜住 iPad 伪装） */
export function isMobile(): boolean {
  if (isiOS() || isAndroid()) return true
  return navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches
}

/** Safari（含 iOS 内所有 WebKit 浏览器）。用于规避 Safari 特有的 WebGL bug */
export function isSafari(): boolean {
  const ua = navigator.userAgent
  return /^((?!chrome|android|crios|fxios).)*safari/i.test(ua) || isiOS()
}

/** 触屏设备（决定是否启用触控手势/隐藏鼠标 hover UI） */
export function isTouchDevice(): boolean {
  return navigator.maxTouchPoints > 0 || 'ontouchstart' in window
}

/** 钳制后的 DPR：移动端最高 1.5、桌面最高 2，避免 HiDPI 下过大的绘制缓冲 */
export function getClampedDPR(): number {
  const raw = window.devicePixelRatio || 1
  return Math.min(raw, isMobile() ? 1.5 : 2)
}

/** 用户是否要求减少动画（无障碍）。可据此降帧/关特效 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
