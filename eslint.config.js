import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import markdown from 'eslint-plugin-markdown'
import importPlugin from 'eslint-plugin-import'
import html from '@html-eslint/eslint-plugin'

export default [
  // 1️⃣ 忽略目录（等价于 ignorePatterns）
  { ignores: ['dist', 'node_modules', '*.min.js', 'coverage'] },

  // 2️⃣ JS 推荐规则（等价于 eslint:recommended）
  js.configs.recommended,

  // 3️⃣ TypeScript 配置
  ...tseslint.configs.recommended,

  // 4️⃣ 你自己的规则 & parserOptions
  // 全局配置（适用于项目中的所有文件）
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022
      },
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
      }
    },

    settings: {
      'import/resolver': {
        alias: {
          map: [['@', './src']],
          extensions: ['.ts', '.js', '.jsx', '.tsx', '.json', '.d.ts']
        }
      }
    },

    plugins: {
      '@typescript-eslint': tseslint.plugin,
      markdown: markdown,
      import: importPlugin
    },

    rules: {
      'no-console': 'warn',
      semi: ['error', 'never'],
      quotes: ['error', 'single'],
      'prefer-const': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn'],
      '@typescript-eslint/explicit-function-return-type': 'off',
      'import/no-mutable-exports': 'error'
    }
  },
  // ==========================================
  // 全局基础配置(不需要类型信息的规则)
  // ==========================================
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser, // 使用 TS parser
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
      }
    },
    rules: {
      // ==========================================
      // 不需要类型信息的规则
      // ==========================================
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
      ]
    }
  },
  // 局部配置
  // ==========================================
  // 源代码:需要类型信息的规则
  // ==========================================
  {
    files: ['src/**/*.ts'],
    ignores: ['**/*.test.ts', '**/*.spec.ts'], // 排除测试文件
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
  // ========== Markdown 文件 ==========
  {
    files: ['**/*.md'],
    processor: markdown.processors.markdown
  },
  // ========== Markdown 中的 JS 代码块 ==========
  {
    files: ['**/*.md/*.js'], // Markdown processor 生成的虚拟文件
    rules: {
      // Markdown 中的示例代码可以放宽规则
      'no-console': 'off',
      'no-unused-vars': 'off',
      'import/no-unresolved': 'off' // 示例代码可能导入不存在的模块
    }
  },
  // ========== HTML 文件 ==========
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
