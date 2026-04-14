export const legacyConfig = {
  // ===== 核心配置 =====

  // 1. targets - 目标浏览器 (最重要!)
  targets: [
    'defaults', // 默认值: > 0.5%, last 2 versions, Firefox ESR, not dead
    'chrome >= 64', // Chrome 64及以上
    'edge >= 79', // Edge 79及以上
    'safari >= 11.1', // Safari 11.1及以上
    'ios >= 11', // iOS Safari 11及以上
    'android >= 5', // Android Browser 5及以上
    'not ie 11', // 排除 IE 11
    '> 1%', // 全球使用率超过1%的浏览器
    'last 2 versions' // 每个浏览器最近的2个版本
  ],

  // 2. renderLegacyChunks - 是否生成legacy版本 (默认: true)
  renderLegacyChunks: true,
  // true: 生成两套代码 (modern + legacy)
  // false: 只生成modern代码,仅polyfill

  // 3. modernPolyfills - 现代浏览器也需要的polyfill
  modernPolyfills: [
    'es.promise.finally', // Promise.finally()
    'es.array.flat', // Array.flat()
    'es.object.from-entries' // Object.fromEntries()
  ],
  // 即使是现代浏览器,某些新特性也可能不支持

  // 4. polyfills - 自定义legacy chunk的polyfills
  polyfills: [
    'es.promise', // Promise
    'es.array.iterator', // 数组迭代器
    'es.object.keys' // Object.keys
  ],
  // 默认自动检测,手动指定可精确控制
  // false: 不生成polyfills (自己处理)

  // 5. additionalLegacyPolyfills - 额外的legacy polyfills
  additionalLegacyPolyfills: [
    'regenerator-runtime/runtime' // async/await支持
  ],
  // 用于添加DOM API等非ES特性的polyfill

  // 6. additionalModernPolyfills - 额外的modern polyfills
  additionalModernPolyfills: [
    'intersection-observer' // IntersectionObserver API
  ],

  // 7. modernTargets - modern版本的目标浏览器
  modernTargets: 'edge>=79, firefox>=67, chrome>=64, safari>=12',
  // 不设置则使用 targets

  // 8. renderModernChunks - 是否生成modern chunks (默认: true)
  renderModernChunks: true,
  // false: 只生成legacy,用于本地file://协议测试

  // ===== 高级配置 =====

  // 9. externalSystemJS - 外部化systemjs (默认: false)
  externalSystemJS: false
  // true: 不打包systemjs到polyfills-legacy中
}
