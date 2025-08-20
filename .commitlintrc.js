module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // 新功能
        'fix', // 修复
        'docs', // 文档
        'style', // 格式化
        'refactor', // 重构
        'perf', // 性能优化
        'test', // 测试
        'chore' // 构建/工具
      ]
    ]
  }
}
