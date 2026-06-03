#!/usr/bin/env node
/**
 * build-docs-index.mjs
 *
 * 扫描 src/** /*.md，按 docs/CONVENTIONS.md 定义的命名规则分类，
 * 生成 docs/INDEX.md。
 *
 * 用法:
 *   node scripts/build-docs-index.mjs            # 写入 docs/INDEX.md
 *   node scripts/build-docs-index.mjs --check    # 仅检查内容是否最新（CI 用）
 *
 * 依赖: Node 18+（用了原生 fs/promises + fs.glob 不是 globby）
 */

import { readdir, readFile, writeFile, stat } from 'node:fs/promises'
import { join, relative, dirname, basename, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// ---- 配置 ----
const ROOT = fileURLToPath(new URL('..', import.meta.url)) // 项目根（脚本上一级）
const SRC = join(ROOT, 'src')
const OUTPUT = join(ROOT, 'docs', 'INDEX.md')

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist-ssr',
  'coverage',
  '.VSCodeCounter'
])

// 与命名规则对应的分类
const CATEGORIES = {
  readme: { title: '一、模块入口 (README)', items: [] },
  archDoc: { title: '二、架构与设计文档 (全大写)', items: [] },
  pairDoc: { title: '三、与源文件配对的说明', items: [] },
  others: { title: '四、其他笔记 / 中文文档', items: [] }
}

// ---- 工具函数 ----

/** 递归列出目录下所有 .md 文件 */
async function walkMarkdown(dir) {
  const out = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    if (EXCLUDE_DIRS.has(e.name)) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      out.push(...(await walkMarkdown(full)))
    } else if (e.isFile() && e.name.endsWith('.md')) {
      out.push(full)
    }
  }
  return out
}

/** 判断同目录下是否有同名（不含扩展）的 .ts/.tsx/.js 文件 */
async function hasSiblingSource(mdPath) {
  const dir = dirname(mdPath)
  const stem = basename(mdPath, '.md') // 文件名去 .md
  for (const ext of ['.ts', '.tsx', '.js', '.mjs', '.glsl', '.vert', '.frag']) {
    try {
      await stat(join(dir, stem + ext))
      return true
    } catch (err) {
      if (err.code === 'ENOENT') {
        return false
      }
      throw err // 其他错误不能吞！
    }
  }
  return false
}

/** 把绝对路径转成相对于项目根的、用 / 分隔的路径（兼容 Windows） */
function toRel(absolute) {
  return relative(ROOT, absolute).split(sep).join('/')
}

/** 把绝对路径转成相对于 docs/INDEX.md 的链接路径 */
function toLink(absolute) {
  return relative(dirname(OUTPUT), absolute).split(sep).join('/')
}

/** 给一个 md 文件分类 */
async function classify(mdPath) {
  const name = basename(mdPath)
  const stem = basename(mdPath, '.md')

  // README.md → 模块入口
  if (name === 'README.md') return 'readme'

  // 全大写（如 ARCHITECTURE / CHANGELOG / ROADMAP / CONTRIBUTING）→ 架构与设计
  // 规则: 文件名（去 .md）全部是 A-Z / 0-9 / _ / -
  if (/^[A-Z0-9_-]+$/.test(stem)) return 'archDoc'

  // 有同名源文件 → 与源文件配对的说明
  if (await hasSiblingSource(mdPath)) return 'pairDoc'

  // 其余: 笔记 / 中文文档 / design-xxx / notes-xxx
  return 'others'
}

// ---- 主流程 ----

async function buildIndex() {
  const allMd = await walkMarkdown(SRC)
  allMd.sort() // 按路径字典序排序

  for (const md of allMd) {
    const cat = await classify(md)
    const dir = toRel(dirname(md)) + '/'
    const link = toLink(md)
    const stem = basename(md, '.md')
    CATEGORIES[cat].items.push({ dir, link, stem, name: basename(md) })
  }

  // 构建 markdown 内容
  const lines = []
  lines.push('# 文档索引 (Documentation Index)')
  lines.push('')
  lines.push('> 由 `scripts/build-docs-index.mjs` 自动生成，请勿手动编辑。')
  lines.push('> 命名与分类规则见 [CONVENTIONS.md](./CONVENTIONS.md)。')
  lines.push('')

  for (const key of ['readme', 'archDoc', 'pairDoc', 'others']) {
    const cat = CATEGORIES[key]
    lines.push(`## ${cat.title}`)
    lines.push('')
    if (cat.items.length === 0) {
      lines.push('*（暂无）*')
      lines.push('')
      continue
    }
    for (const item of cat.items) {
      // 显示形式: - `src/xxx/` — [README.md](../src/xxx/README.md)
      lines.push(`- \`${item.dir}\` — [${item.name}](${item.link})`)
    }
    lines.push('')
  }

  // 统计
  const total = Object.values(CATEGORIES).reduce((sum, c) => sum + c.items.length, 0)
  lines.push('---')
  lines.push('')
  lines.push(`**统计**: 共 ${total} 个 markdown 文档`)
  for (const key of ['readme', 'archDoc', 'pairDoc', 'others']) {
    const cat = CATEGORIES[key]
    lines.push(`- ${cat.title}: ${cat.items.length}`)
  }
  lines.push('')

  return lines.join('\n')
}

async function main() {
  const content = await buildIndex()
  const checkMode = process.argv.includes('--check')

  if (checkMode) {
    let existing = ''
    try {
      existing = await readFile(OUTPUT, 'utf8')
    } catch (err) {
      if (err.code === 'ENOENT') {
        return false
      }
      throw err // 其他错误不能吞！
    }
    if (existing.trim() === content.trim()) {
      console.log('✓ docs/INDEX.md is up to date.')
      process.exit(0)
    } else {
      console.error('✗ docs/INDEX.md is out of date. Run: node scripts/build-docs-index.mjs')
      process.exit(1)
    }
  }

  await writeFile(OUTPUT, content, 'utf8')
  console.log(`✓ Wrote ${toRel(OUTPUT)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
