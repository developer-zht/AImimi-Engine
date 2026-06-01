# SceneLoader（场景注册表草案）

> **状态**：未启用。当前 `SceneLoader.ts` 整文件被注释，无任何引用。本文档记录其设计意图，供未来实现参考。

## 背景

当前 `Engine` 直接 import 各个 `loadXXXScene` 函数（如 `loadHW1Scene`、`loadFFTOceanScene-single-layer` 等），存在两个问题：

1. **耦合**：Engine 必须知道所有场景文件的具体路径
2. **可扩展性差**：新增一个场景就要修改 Engine 代码

## 设计目标

通过**注册表模式**解耦场景模块与 Engine：

- 每个场景模块在加载时**自注册**：`registerScene(id, loadFn)`
- Engine 按 id 动态加载：`loadScene(id, ctx)`
- 支持运行时查询所有可用场景：`getRegisteredScenes()`

## 接口草案

```ts
import { SceneContext } from './types/SceneContext'

export type SceneLoadFn = (ctx: SceneContext) => Promise<void>

const sceneRegistry: Map<string, SceneLoadFn> = new Map()

/** 注册一个场景（由场景模块在模块顶层调用） */
export function registerScene(id: string, loadFn: SceneLoadFn): void {
  if (sceneRegistry.has(id)) {
    console.warn(`[SceneLoader] Scene "${id}" is already registered, overwriting`)
    return
  }
  sceneRegistry.set(id, loadFn)
}

/** 加载指定场景（由 Engine 调用） */
export async function loadScene(id: string, ctx: SceneContext): Promise<void> {
  const loadFn = sceneRegistry.get(id)
  if (!loadFn) {
    throw new Error(
      `[SceneLoader] Unknown scene: "${id}". Available: [${[...sceneRegistry.keys()].join(', ')}]`
    )
  }
  await loadFn(ctx)
}

/** 获取所有已注册的场景 id */
export function getRegisteredScenes(): string[] {
  return [...sceneRegistry.keys()]
}
```

## 场景模块的接入方式（示例）

```ts
// src/scenes/hw1/loadHW1Scene.ts
import { registerScene } from '@/scenes/SceneLoader'

async function loadHW1Scene(ctx: SceneContext) {
  /* ... */
}

registerScene('hw1', loadHW1Scene)
```

## 触发条件

当前先不引入，原因：

- 场景数量较少（≤ 10），耦合成本可接受
- Engine 仍处于频繁重构期，过早抽象有风险

**实施时机**：

- 场景数量 ≥ 15
- 需要支持运行时动态加载（如热插拔、用户自定义场景）
- 需要 UI 自动枚举场景（参考 `src/ui/SceneSwitcher.example.ts`）

## 相关文件

- `src/scenes/SceneLoader.ts` — 草案代码（已全部注释）
- `src/scenes/types/SceneContext.d.ts` — 场景上下文类型
- `src/ui/SceneSwitcher.example.ts` — 配套的场景切换 UI 示例（依赖注册表查询能力）
