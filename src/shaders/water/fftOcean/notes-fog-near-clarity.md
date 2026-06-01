# notes: Fog 近处通透调节

> 临时笔记 / 草稿。日后若采纳，可移至 `src/shaders/water/fftOcean/notes-fog-near-clarity.md`

> （命名已符合 CONVENTIONS.md「其他笔记」规则）。

>

> 主题：开启 `useFog: 1` 后整体偏蒙眬，如何让**近处更通透**、雾只作用于远景。

> 关联源文件：`src/shaders/water/fftOcean/fragment-multi-layers.frag`（fog 段）

---

## 1. 现状代码

`fragment-multi-layers.frag`（约 :676-686）：

// ---- fog: Atmospheric perspective（受 uUseFog 控制） ----
// 物理含义：光从远处水面传到相机，要穿过 d 米空气，每 m 损失一点能量并混入大气底色
// color_final = mix(color, fogColor, 1 - exp(-d / falloff))
// falloff 越小越雾，越大越透
if (uUseFog == 1) {
float dist = length(uCameraPos - vWorldPosition); // 米
float fogFactor = 1.0 - exp(-pow(dist \* uFogDensity, uFogPower));
color = mix(color, uFogColor, fogFactor);
}

相关 uniform 默认值（`src/materials/water/_config/defaults.ts`）：

fogColor: [0.7, 0.78, 0.85], // horizon 蓝灰
fogDensity: 0.004, // = 1/256m
fogPower: 1.0, // 标准 exp fog

---

## 2. 为什么近处也蒙

指数雾 `fogFactor = 1 - exp(-x)`，其中 `x = pow(dist·density, power)`。

- 当 `power = 1` 时，`x = dist·density`，近处 dist 虽小，但只要 density 偏大，

  `1 - exp(-x)` 在 x 小时 ≈ x（近似线性上升）→ **近水面立刻被混入雾色**。

- 即「雾从 dist=0 就开始起」，没有近处的「无雾保护区」。

物理上：真实大气透视近景几乎无雾，雾应随距离非线性增强。当前公式在近处太激进。

---

## 3. 调节旋钮（从易到难，按治本程度）

### 旋钮 3 ★ 最快尝试（只改 config，零 shader 改动）

把 `fogPower` 从 `1.0` 调到 `2.0 ~ 3.0`。

- 原理：`pow(dist·density, power)`，当底数 `dist·density < 1`（近处）时，

  **高次幂会把它压得更小** → 近处雾更淡；远处底数 ≥1，高次幂照样浓。

- 效果：近处通透、远处不变。

- 代价：无（已有 `uFogPower` uniform）。**先试这个。**

### 旋钮 2 ★ 推荐治本（加近处无雾区，最物理）

让雾从某个起始距离 `fogStart` 之后才开始：

if (uUseFog == 1) {
float dist = length(uCameraPos - vWorldPosition);
float d = max(0.0, dist - uFogStart); // uFogStart 米内完全无雾
float fogFactor = 1.0 - exp(-pow(d \* uFogDensity, uFogPower));
color = mix(color, uFogColor, fogFactor);
}

- `uFogStart` 建议 30~80 米：近景一片通透，超过才渐起雾。

- 代价：新增 `uFogStart` uniform（material + config + 类型 + shader 声明）。

- 这是真实大气透视的常见做法（近景不该有雾）。

### 旋钮 1 整体推远（最简单但远处也变透）

调小 `fogDensity`（如 0.004 → 0.002）。

- 缺点：远处雾也跟着变淡，未必是想要的「近透远浓」。

### 旋钮 4 封顶雾浓度（防最远处全糊）

fogFactor = min(fogFactor, uFogMaxStrength); // 如 0.8，永远留 20% 本色

- 防止极远处完全变纯雾色，保留一点水体本色。

- 代价：新增 `uFogMaxStrength` uniform。

---

## 4. 建议落地顺序

1. 先试 **旋钮 3**（`fogPower` 1.0 → 2.5），只改 config，看近处是否通透。

2. 不够再上 **旋钮 2**（加 `uFogStart`，最物理）。

3. 远处太糊再叠 **旋钮 4**（封顶）。

---

## 5. 若新增 uniform（旋钮 2 / 4），需同步改的文件

| 文件 | 改动 |

|---|---|

| `src/materials/water/types/WaterMaterialConfig.d.ts` | 加 `fogStart?: number` / `fogMaxStrength?: number` |

| `src/materials/water/_config/defaults.ts` | 加默认值（如 `fogStart: 50`、`fogMaxStrength: 0.85`）|

| `src/materials/water/FFTOceanMaterial-MultiLayers.ts` | 加 `uFogStart` / `uFogMaxStrength`（ONE_F）|

| `fragment-multi-layers.frag` | 加 `uniform float uFogStart;` 等 + 上面 fog 逻辑 |

| `fftOceanSceneConfig-MultiLayers.ts` | 按需覆盖场景值 |
