# 项目约定 (Conventions)

本文档收录项目级别的协作约定（命名、目录结构、文档组织等）。模块级技术细节请放在对应模块下的 README.md。

---

## 一、Markdown 文档命名

### 命名规则

| 文件名模式                       | 用途                               | 示例                                               |
| -------------------------------- | ---------------------------------- | -------------------------------------------------- |
| `README.md`                      | **模块入口**——介绍这是什么、怎么用 | `src/scenes/README.md`                             |
| `ARCHITECTURE.md`                | 架构设计、模块边界                 | `src/managers/fftOcean/ARCHITECTURE.md`            |
| `CHANGELOG.md`                   | 变更日志                           | `CHANGELOG.md`                                     |
| `CONTRIBUTING.md`                | 贡献指南                           | `CONTRIBUTING.md`                                  |
| `TODO.md` / `ROADMAP.md`         | 待办、路线图                       | `TODO.md`                                          |
| `notes-xxx.md` / `design-xxx.md` | 临时笔记、设计草稿                 | `notes-cascade-layers.md`、`design-kulla-conty.md` |
| `<SourceFile>.md`                | 与某个源文件一一对应的说明         | `SceneLoader.md`（与 `SceneLoader.ts` 同目录）     |

### 大小写规则

- **约定俗成的特殊文件用全大写**：README、LICENSE、CHANGELOG、CONTRIBUTING、ARCHITECTURE、ROADMAP
- **个人工作笔记用小写 + 短横线**：`design-xxx.md`、`notes-xxx.md`
- **与单个源文件配对的说明**：与源文件同名（保留源文件的大小写）

这样从文件名一眼能区分**正式文档**和**草稿笔记**。

### 同一目录多个 md 文件如何取舍

完全允许同目录多个 md。常见组合：

```
src/managers/fftOcean/
├── README.md            ← 模块总览（必备）
├── ARCHITECTURE.md      ← 架构设计（可选，复杂模块才需要）
├── CHANGELOG.md         ← 变更记录（一般只在项目根，模块级少见）
└── notes-cascade.md     ← 个人笔记（可选）
```

**判断标准**：

- 总览/快速上手 → `README.md`
- 深入的架构/算法推导 → 单独文档（`ARCHITECTURE.md` 或 `design-xxx.md`）
- 短期笔记/草稿 → `notes-xxx.md`

避免把所有内容塞进一个超长 README。

---

## 二、文档索引（docs/INDEX.md）

### 索引生成策略

通过脚本扫描 `src/**/*.md`，**按文件名规则分类**输出到 `docs/INDEX.md`：

```
# 文档索引

## 一、模块入口（README）
- src/scenes/ — [README](../src/scenes/README.md)
- src/shaders/water/ — [README](../src/shaders/water/README.md)

## 二、架构与设计文档（全大写）
- src/managers/fftOcean/ARCHITECTURE.md
- src/textures/cubemap/ARCHITECTURE.md

## 三、与源文件配对的说明
- src/scenes/SceneLoader.md
- src/ui/SceneSwitcher.example.md

## 四、其他笔记
- src/managers/fftOcean/notes-cascade-layers.md
- src/shaders/lighting/pbr/design-kulla-conty.md
```

### 扫描排除规则

- `node_modules/**`
- `**/CHANGELOG.md`（一般不需要进索引）
- `.git/**`
- 项目根的 `README.md` 本身（直接通过仓库主页看）

### 自动化

索引脚本位于 `scripts/build-docs-index.js`（待添加），可手动执行或挂到 git pre-commit hook。

---

## 三、Conventional Commits 提交类型

提交信息使用 conventional commits 规范，常用 type：

| Type       | 用途                               |
| ---------- | ---------------------------------- |
| `feat`     | 新增功能                           |
| `fix`      | 修复缺陷                           |
| `docs`     | 文档更新（包括本目录下的 md 文件） |
| `style`    | 代码格式（不影响逻辑）             |
| `refactor` | 代码重构（既非新功能也非修 bug）   |
| `perf`     | 性能优化                           |
| `test`     | 测试相关                           |
| `build`    | 构建系统/依赖                      |
| `ci`       | CI 配置                            |
| `chore`    | 杂项（不修改 src 或 test）         |
| `revert`   | 回退 commit                        |

---

## 四、目录结构（节选）

- `src/` — 引擎源码
- `tests/` — 单元/集成测试
- `public/` — 静态资源
- `docs/` — 项目级文档（本文档所在）
- `scripts/` — 工程脚本（构建、索引生成等）
- `lut-gen/` — BRDF LUT 离线生成工具
- `prt/` — PRT 球谐预计算工具

模块级文档（README.md 等）放在对应模块目录内，不集中到 `docs/`。
