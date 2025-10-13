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
        'chore', // 构建/工具
        'ci' // 持续集成
      ]
    ],
    // 修改提交信息中 subject 的最大字符数
    'subject-max-length': [2, 'always', 150]
    // 修改提交信息中 subject 的最小字符数
    // 'subject-min-length': [1, 'always', 5]
  }
}
