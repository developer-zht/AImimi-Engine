# SceneSwitcher（场景切换 UI 示例）

> **状态**：示例代码 / 未启用。依赖 `@/managers/scene-deprecated/SceneManager`，该 SceneManager 已被废弃。本组件作为**未来场景管理器 + 注册表**配套 UI 的参考实现保留。

## 功能概述

一个浮动在视口右上角的场景切换面板，提供：

- 列出所有可用场景的按钮（带名称、描述提示）
- 高亮当前激活场景
- 点击按钮异步切换场景（带 loading 状态）
- 显示当前场景信息（名称 + 描述）
- 键盘快捷键 `H` 切换面板显示/隐藏
- 鼠标悬停反馈效果

## 为什么是 `.example.ts` 而非正式模块

文件名带 `.example` 后缀，表明：

1. **依赖未就绪**：当前 `SceneManager` 来自 `scene-deprecated/`，未来需要重写
2. **配套 SceneLoader 注册表**：完整能力依赖 `registerScene` / `getAvailableScenes` 这套接口（见 [SceneLoader.md](../scenes/SceneLoader.md)）
3. **保留作参考**：完整可运行的 UI 设计（CSS、交互、键盘快捷键）值得在未来重写时直接复用

## 依赖关系

```
SceneSwitcher.example.ts
  ├─ SceneManager（@/managers/scene-deprecated）  ← 已废弃，需重写
  └─ DOM API（document、HTMLDivElement）          ← 浏览器原生
```

需要 `SceneManager` 提供以下接口：

| 方法                                      | 用途            |
| ----------------------------------------- | --------------- |
| `getAvailableScenes(): string[]`          | 列出所有场景 id |
| `getCurrentScene(): string`               | 当前激活场景 id |
| `getSceneInfo(id): { name, description }` | 场景元数据      |
| `loadScene(id): Promise<void>`            | 异步切换场景    |

## 在 Engine 中的集成方式（草案）

```ts
// src/engine.ts
import { SceneManager } from '@/managers/scene/SceneManager' // 重写后的位置
import { SceneSwitcher } from '@/ui/SceneSwitcher.example'

export class Engine {
  private sceneManager: SceneManager
  private sceneSwitcher: SceneSwitcher

  async init() {
    // ... 现有初始化

    this.sceneManager = new SceneManager(this)
    await this.sceneManager.loadConfig()

    // 从 URL 参数读取默认场景，缺省为 fft-ocean
    const urlParams = new URLSearchParams(window.location.search)
    const sceneId = urlParams.get('scene') || 'fft-ocean'
    await this.sceneManager.loadScene(sceneId)

    this.sceneSwitcher = new SceneSwitcher(this.sceneManager)
  }
}
```

## UI 设计要点

| 维度       | 实现细节                                              |
| ---------- | ----------------------------------------------------- |
| 定位       | `position: fixed; top: 20px; right: 20px;` 视口右上角 |
| 层级       | `z-index: 1000`，覆盖在 canvas 之上                   |
| 视觉       | 半透明黑底（`rgba(0, 0, 0, 0.8)`）+ 圆角 + 投影       |
| 当前场景   | 绿色按钮（`#4CAF50`）+ 同色边框                       |
| 非激活场景 | 深灰按钮（`#333`），悬停时轻微提亮                    |
| 切换中     | 按钮禁用，文字改为 "Loading..."                       |
| 切换失败   | 浏览器 `alert()` 提示（生产环境应换成 toast）         |

## 已知局限

1. **刷新方式粗糙**：`refreshUI()` 直接移除整个面板重建，未来可改成增量更新
2. **错误提示**：使用 `alert()`，应换成项目统一的 toast 组件
3. **依赖 deprecated SceneManager**：直接编译会失败，等 SceneManager 重写后才能启用

## 相关文件

- `src/ui/SceneSwitcher.example.ts` — 源码
- `src/scenes/SceneLoader.md` — 配套的场景注册表设计
- `src/managers/scene-deprecated/SceneManager.ts` — 当前依赖（已废弃，待重写）
