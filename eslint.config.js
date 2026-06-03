import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import markdown from 'eslint-plugin-markdown'
import importPlugin from 'eslint-plugin-import'
import html from '@html-eslint/eslint-plugin'

export default [
  // ==========================================
  // Global
  // ==========================================

  // ==================== 忽略目录（等价于 ignorePatterns）====================
  {
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '**/node_modules/**', '**/*.min.js']
  },

  // ==================== Third Party cCnfig ====================
  // JS 推荐规则（等价于 eslint:recommended）
  js.configs.recommended,
  // TypeScript 配置
  ...tseslint.configs.recommended,

  // Customed Config
  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2020
      }
    },

    plugins: {
      import: importPlugin,
      '@typescript-eslint': tseslint.plugin
      // markdown: markdown,
    },

    settings: {
      'import/resolver': {
        alias: {
          map: [['@', './src']],
          extensions: ['.ts', '.js', '.json', '.d.ts']
        }
      }
    },

    rules: {
      // prettier format
      'no-console': 'warn',
      semi: ['error', 'never'],
      quotes: ['error', 'single'],
      'prefer-const': 'warn',
      // 强制注释符号后必须有空格
      'spaced-comment': [
        'error',
        'always',
        {
          line: {
            markers: ['/'],
            exceptions: ['-', '+', '=']
          },
          block: {
            markers: ['!'],
            exceptions: ['*'],
            balanced: true
          }
        }
      ],
      // typescript
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',

      // 命名约定
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: 'interface',
          format: ['PascalCase']
        },
        {
          selector: 'typeAlias',
          format: ['PascalCase']
        }
      ],
      // import plugin
      // 禁止导出 let 声明的变量，解决 ESModule 的符号绑定(Live Binding)问题
      'import/no-mutable-exports': 'error'
    }
  },

  // ==========================================
  // Local
  // ==========================================

  // ==================== src ====================
  {
    files: ['src/**/*.ts'],
    ignores: [
      '**/*.test.ts', // 排除测试文件
      '**/*.spec.ts', // 排除测试文件
      '**/*.md/**', // 排除 Markdown 虚拟文件
      '**/*.md/*.ts' // 排除 Markdown 虚拟文件
    ],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.app.json' // 源代码用 app 配置
      }
    },
    rules: {
      // ==========================================
      // 需要类型信息的规则(更严格)
      // ==========================================

      // Promise 相关
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/promise-function-async': 'warn',

      // 类型安全
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'error',

      // 代码质量
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/strict-boolean-expressions': 'off' // 可能太严格
    }
  },

  // ==================== test ====================
  {
    files: ['tests/**/*.ts', 'src/**/*.{test,spec}.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.test.json' // 测试用 test 配置
      }
    },
    rules: {
      // 测试文件允许的宽松规则
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',

      // 测试中的 expect 语句
      '@typescript-eslint/no-floating-promises': 'off'
    }
  },

  // ==================== config ====================
  {
    files: ['*.config.ts', '*.config.*.ts', 'scripts/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.node.json' // 配置用 node 配置
      }
    },
    rules: {
      // 配置文件可以使用 console
      'no-console': 'off'
    }
  },

  // ==================== Markdown ====================
  {
    files: ['**/*.md'],
    processor: markdown.processors.markdown
  },
  // Markdown 中的代码块
  {
    files: ['**/*.md/*.ts', '**/*.md/*.js'], // Markdown processor 生成的虚拟文件
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
        // ✅ 不设置 project
      }
    },
    rules: {
      // Markdown 中的示例代码可以放宽规则
      'no-console': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'import/no-unresolved': 'off', // 示例代码可能导入不存在的模块
      '@typescript-eslint/no-floating-promises': 'off', // ✅ 关闭需要类型信息的规则
      '@typescript-eslint/await-thenable': 'off'
    }
  },

  // ==================== HTML 文件 ====================
  {
    files: ['**/*.html', '**/*.htm'],
    plugins: {
      html: html
    },
    language: 'html/html',
    rules: {
      'html/no-duplicate-class': 'error'
    }
  }
]
