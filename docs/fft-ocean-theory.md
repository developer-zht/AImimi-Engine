# FFT Ocean Theory — 理论、数学↔代码、落地陷阱

> 这篇只讲两件事:**为什么 (why)** 和 **理论怎么变成代码 (math → code)**。
> 机制数据流(每个 pass 干什么)看 [`fft-ocean-pipeline.md`](./fft-ocean-pipeline.md);
> 上手阅读顺序看 [`learning-path.md`](./learning-path.md);
> 轴约定那个 transpose bug 的完整复盘看 [`postmortem-fft-axis-misalignment.md`](../src/simulation/ocean/fft/postmortem-fft-axis-misalignment.md)。
>
> 每个主题统一按 **直觉 (intuition) → 公式 (formula) → 代码 (code) → 陷阱 (gotcha)** 四段写。
> "陷阱"是这篇的命门——专记把纸面公式搬到 GPU 时容易翻车的地方(归一化、符号、离散化、约定)。

---

## §0 与其它文档的关系 (Where this fits)

| 文档                                  | 回答的问题                                 | 本篇是否重复                |
| ------------------------------------- | ------------------------------------------ | --------------------------- |
| `learning-path.md`                    | 按什么**顺序**读代码                       | 否                          |
| `fft-ocean-pipeline.md`               | 数据**怎么流**、每个 pass 干什么           | 否(本篇不讲机制,只讲为什么) |
| `postmortem-fft-axis-misalignment.md` | 一个具体轴 bug 的诊断复盘                  | 否(本篇只在 §5/§6 指向它)   |
| **本篇**                              | **为什么这样设计 + 公式↔代码 + 落地陷阱** | —                           |

公式格式:关键方程用 LaTeX($...$ / $$...$$),行内小符号用 ASCII。代码引用到**文件 + 函数/区域名**(不写行号,避免过期)。

---

## §1 符号与单位速查 (Symbols & Units)

| 符号                     | 含义                                             | 单位  |
| ------------------------ | ------------------------------------------------ | ----- |
| $\mathbf{x}=(x,z)$       | 水平面坐标(注意是 **x–z 平面**,y 是高度)         | m     |
| $\mathbf{k}=(k_x,k_z)$   | 波矢 (wave vector),方向=波的排列方向             | rad/m |
| $\lvert\mathbf{k}\rvert$ | 波数大小,$\lambda = 2\pi/\lvert\mathbf{k}\rvert$ | rad/m |
| $\omega$                 | 角频率 (angular frequency)                       | rad/s |
| $g$                      | 重力加速度 ≈ 9.81                                | m/s²  |
| $\tilde h_0(\mathbf{k})$ | 初始频谱 (initial spectrum),复振幅               | m     |
| $\tilde h(\mathbf{k},t)$ | $t$ 时刻频谱                                     | m     |
| $D_x,D_y,D_z$            | 空域位移 (displacement),$D_y$ 是高度             | m     |
| $N$                      | FFT 分辨率 (resolution),2 的幂                   | —     |
| $L$                      | 单层 patch 物理尺寸 (size)                       | m     |
| $\Delta k$               | 频域采样间隔 $=2\pi/L$                           | rad/m |
| $\alpha,\beta$           | choppiness(水平位移缩放,艺术量)                  | —     |

> **约定**:全链路统一为 `world.x = kx = texture.x = 列(m)`、`world.z = kz = texture.y = 行(n)`。
> 这条约定是用十几轮 debug 换来的,细节见 postmortem。

---

## §2 线性波的有限叠加 (Finite Superposition of Linear Waves)

### 直觉

海面看着复杂,但 FFT Ocean 的世界观极其简单:**海面 = 一大堆正弦波(线性波)叠加**。每个波矢 $\mathbf{k}$ 对应一列方向、波长确定的正弦波,把它们按各自的复振幅加起来,就是海面。

"真实海面"是**连续**的波谱(无穷多个 $\mathbf{k}$)。但计算机只能算有限个,所以我们在频域取一张 $N\times N$ 的网格,**只叠加这 $N^2$ 个波**。FFT 不是什么"魔法变换",它只是**把这个巨大的求和算快了**。

### 公式

连续形式(Tessendorf):
$$h(\mathbf{x},t)=\sum_{\mathbf{k}} \tilde h(\mathbf{k},t)\,e^{\,i\,\mathbf{k}\cdot\mathbf{x}}$$

离散化:$\mathbf{k}$ 取 $k_x=\tfrac{2\pi m}{L},\;k_z=\tfrac{2\pi n}{L}$,其中 $m,n\in\{-\tfrac N2,\dots,\tfrac N2-1\}$。这正是 2D IDFT 的形式,所以可以用 IFFT 在 $O(N^2\log N)$ 内算完。

### 代码

- 枚举 $\mathbf{k}$ 网格:`InitialSpectrum.waveNumber()` —— 把索引 $0\dots N{-}1$ 折成有符号的 $-\tfrac N2\dots\tfrac N2{-}1$,再乘 $\Delta k=2\pi/L$。
- 高效叠加:`FFTStockham2D.frag` —— 把 2D IFFT 拆成"先行后列"各 $\log_2 N$ 个 Stockham stage。

### ⚠️ 陷阱

1. **周期平铺 (tiling repeat)**:因为只取了有限个离散 $\mathbf{k}$,IFFT 的结果在空间上**严格周期**,周期就是 $L$。一张 FFT 贴图平铺到大海面时,会看到肉眼可辨的重复花纹。这是离散本质,不是 bug——缓解靠 cascade 多层不同 $L$ 错开(见 pipeline.md §14),不是靠调参。

2. **频谱截断 (spectral truncation)**:$\lvert\mathbf{k}\rvert$ 太小(超长波)和太大(超短毛细波)都表达不了。代码里用 `kMin/kMax` 截断(见 `JONSWAPSpectrum.calculateH0Magnitude`),每层 cascade 负责一段波长。

3. **省掉的 $1/N^2$ 去哪了(本篇头号陷阱)**。教科书 IDFT 是
   $$x[n,m]=\frac{1}{N^2}\sum_{k,l}X[k,l]\,W_N^{-kn}W_N^{-lm}$$
   那个 $\tfrac{1}{N^2}$ 很显眼。但本项目的 `FFTStockham2D.frag` **故意不乘** $1/N^2$(代码里 `result *= scale` 那行是注释掉的)。归一化被**折进了频谱振幅**:`JONSWAPSpectrum.calculateH0Magnitude` 里
   $$\lvert\tilde h_0\rvert^2 = 2\,S(\omega)\,\frac{\lvert d\omega/dk\rvert}{\lvert k\rvert}\cdot\underbrace{\frac{4\pi^2}{L^2}}_{(\Delta k)^2}$$
   那个 $4\pi^2/L^2=(\Delta k)^2$ 就是把连续谱积分 $\int S\,d^2k$ 离散成求和 $\sum S\,(\Delta k)^2$ 时带来的因子,它承担了归一化。
   - **后果**:如果你"好心"在 IFFT shader 里把 $1/N^2$ 加回去,就是**双重归一化**,海面会瞬间被压平成一张纸。
   - **记牢**:这条管线的归一化**不在 IFFT 里,在频谱振幅里**。改任何一端前先想清楚另一端。

---

## §3 色散关系 & 波速 (Dispersion & Wave Speed)

### 直觉

海面会动,是因为**每个波都在以自己的速度前进**。关键事实:**波长不同,速度不同**——长波快、短波慢(深水重力波)。这种"不同频率跑不同速度"的性质就叫**色散 (dispersion)**。正是色散让叠加出来的海面不是僵硬平移,而是不断重组、起伏。

### 公式

深水重力波的色散关系:
$$\omega(\mathbf{k})=\sqrt{g\,\lvert\mathbf{k}\rvert}$$
相速度 (phase velocity) $c=\omega/\lvert k\rvert=\sqrt{g/\lvert k\rvert}$;群速度 (group velocity) $c_g=d\omega/d\lvert k\rvert=\tfrac12\sqrt{g/\lvert k\rvert}=c/2$。

时间演化(让每个频率随时间转相位,并保持共轭对称以输出实数):
$$\tilde h(\mathbf{k},t)=\tilde h_0(\mathbf{k})\,e^{\,+i\omega t}+\overline{\tilde h_0(-\mathbf{k})}\,e^{\,-i\omega t}$$

### 代码

- $\omega$ 与 $e^{i\omega t}$:`realtimeSpectrum/fragment.frag`,`omega = sqrt(uGravity * kLength)`,再用 `cos(ωt)/sin(ωt)` 展开复数旋转。
- 谱振幅里的 $d\omega/dk$:`JONSWAPSpectrum.calDispersionDerivative()`(用于把 $S(\omega)$ 换算到 $S(k)$)。

### ⚠️ 陷阱

1. **两处色散关系不一致(隐蔽 bug)**。色散关系 $\omega(\mathbf k)$ 有两个版本:

   | 版本                   | 公式                                                     | 适用     |
   | ---------------------- | -------------------------------------------------------- | -------- |
   | 深水版(忽略水深)       | $\omega=\sqrt{g\lvert k\rvert}$                          | 水足够深 |
   | 有限水深版(含水深 $d$) | $\omega=\sqrt{g\lvert k\rvert\,\tanh(\lvert k\rvert d)}$ | 任意水深 |

   $\lvert k\rvert d$ 很大时 $\tanh\to1$,两版本重合;水浅时 tanh 版给出更低的频率(波更慢)。

   **问题**:$\omega$ 在管线里有两个用途,却各用了不同版本:
   - **用途 A · 波速 / 动画**:`realtimeSpectrum/fragment.frag` 的 `omega = sqrt(uGravity * kLength)` —— **纯深水版,没读 depth**。它决定浪跑多快。
   - **用途 B · 谱形 / 振幅**:`JONSWAPSpectrum.calDispersion / calDispersionDerivative` —— **tanh 有限水深版,带了 depth**。它决定各波长的能量配比。

   于是 **波速按"水无限深"算,能量分布却按"水有限深"算**,两边对水深的态度自相矛盾。直观后果:调 `depth` 参数**只改谱形、不改波速**。深水场景看不出问题($\tanh\to1$);**浅水场景会不自洽**——能量"知道"水浅了,浪的运动却仍按深水跑。

   > 💡 **未来修复提示**:统一到有限水深版。给 `realtimeSpectrum/fragment.frag` 加一个 `uDepth` uniform,把演化改成
   > `omega = sqrt(uGravity * kLength * tanh(min(kLength * uDepth, 20.0)))`,与 `JONSWAPSpectrum.calDispersion` 完全对齐(注意 `min(_, 20)` 的 clamp 也要带上,防 `tanh` 上溢)。最干净的做法是把这条色散公式抽成**单一可复用定义**(CPU/GPU 共享同一份),从源头杜绝再次分叉。改前确认:你确实要支持浅水;若永远只跑深水,保持现状也对,但应在两处都注明"故意只做深水"。

2. **时间回绕 / 循环动画**。$t$ 无限增长时 `sin(ωt)` 的浮点精度会退化,且若想做无缝循环,需要把所有 $\omega$ 量化到一个公共基频的整数倍。当前实时路径直接用累计 $t$,**没有**做循环量化——长时间运行后高频相位精度下降是已知代价。

3. **单位一致性**。$g$ [m/s²]、$\lvert k\rvert$ [rad/m]、$t$ [s] 必须配套。$\omega$ 出来是 [rad/s]。任何一处把波长 $\lambda$ 当 $\lvert k\rvert$ 用,色散就整体错。

---

## §4 xz 偏移 / choppiness(为什么必须有水平位移)

### 直觉

只用高度位移($D_y$)的海面,波峰是**圆钝的正弦包**,一眼假。真实的浪是**波峰尖、波谷宽**。要做出这种形状,光把顶点往上推不够,还得**把顶点沿水平方向往波峰底下聚拢**——这就是 Gerstner 波的核心思想,也是 FFT Ocean 里 $D_x,D_z$ 水平位移的意义。

换句话说:**FFT 本质是线性波的有限叠加,而线性叠加天然给不出尖波峰;尖波峰是靠额外的水平位移"挤"出来的,不是叠加出来的。** 这是从"数学上正确的高度场"到"看起来真实的浪"之间最关键的一步。

### 公式

水平位移谱(频域里对高度谱乘 $-i\hat{\mathbf k}$):
$$\tilde D_x=-i\,\frac{k_x}{\lvert k\rvert}\,\tilde h,\qquad \tilde D_z=-i\,\frac{k_z}{\lvert k\rvert}\,\tilde h$$
IFFT 后得到空域 $D_x,D_z$。顶点最终位置(choppiness $\alpha,\beta$ 缩放水平位移强度):
$$P'=(x+\alpha D_x,\;\;D_y,\;\;z+\beta D_z)$$

### 代码

- 频域构造 $\tilde D_x,\tilde D_z$:`realtimeSpectrum/fragment.frag`(`disp = -i·k̂·h̃` 那段)。
- 应用 choppiness + 算 Jacobian + foam:`packedAssembly/fragment.frag`(`finalDx = Dx * uChoppiness.x`)。
- 顶点位移:`vertex-multi-layers.vert`(把各层 displacement 叠加进顶点)。

### ⚠️ 陷阱

1. **choppiness 过大 → 自相交折叠**。水平位移把网格点 $(x,z)$ 映射到 $(x+\alpha D_x,\,z+\beta D_z)$,这个映射的 Jacobian 行列式
   $$\det J=(1+\alpha\,\partial_x D_x)(1+\beta\,\partial_z D_z)-\alpha\beta\,(\partial_z D_x)(\partial_x D_z)$$
   当 $\det J<0$,表面发生折叠(波峰翻卷)。代码用 $\det J$ 触发泡沫(`packedAssembly` 的 foam EMA)。$\alpha$ 调太大,整片海面会到处折叠、泡沫糊脸。choppiness 是**艺术参数,不是物理参数**——它没有"正确值"。

2. **法线必须用位移后的斜率修正**。IFFT 给的是参数空间(Lagrangian)斜率 $\partial h/\partial x$,但渲染要的是显示空间(Eulerian)斜率 $\partial h/\partial x_{\text{vertex}}$。链式法则给出近似
   $$\frac{\partial h_{\text{disp}}}{\partial x_{\text{vertex}}}\approx\frac{\partial h/\partial x}{1+\alpha\,\partial_x D_x}$$
   见 `packedAssembly` 的 `slopeX_corr = slopeX / max(denomX, 0.3)`。**忘了这个除法,choppy 越强法线越错**,高光会乱跳。那个 `max(_, 0.3)` 下界不是单纯防除零:折叠边缘 $denom\to0$ 会把斜率放大到爆,法线乱跳成暗色条纹 (streak);抬到 0.3 是牺牲折叠边缘精度换稳定(反正那里会被 foam 盖住)。

3. **simpleWaves / Gerstner 代码当前不在仓库**。本节的 Gerstner 对照纯属理论说明;项目里只有 FFT 版的水平位移实现,没有解析 Gerstner 场景代码。

---

## §5 频域求导 i·k(+ Hermitian + 随机相位)

### 直觉

需要海面的**梯度(法线)、位移、位移导数(Jacobian)**——这些本来都要做空间微分,很贵。但有个免费午餐:**在频域里,空间求一次导 = 乘 $i\mathbf{k}$**。所以法线、Jacobian 这些导数,全都在频域顺手乘个系数就拿到了,和高度共用同一次 IFFT。

### 公式

微分算子:$\dfrac{\partial}{\partial x}\leftrightarrow i k_x$。于是
$$\text{slope}=\nabla h\leftrightarrow i\mathbf{k}\,\tilde h,\qquad \tilde D_x=-i\tfrac{k_x}{\lvert k\rvert}\tilde h,\qquad \partial_x D_x\leftrightarrow i k_x\tilde D_x$$
为保证 IFFT 输出是**实数**高度场,频谱必须 **Hermitian 共轭对称**:
$$\tilde h(-\mathbf{k})=\overline{\tilde h(\mathbf{k})}$$
初始谱注入随机性(频谱定统计规律,随机数定"这一次"的具体海面):
$$\tilde h_0(\mathbf{k})=\frac{1}{\sqrt2}\,(\xi_r+i\,\xi_i)\,\lvert\tilde h_0(\mathbf{k})\rvert,\quad \xi_r,\xi_i\sim\mathcal N(0,1)$$

### 代码

- 各路 $i\mathbf{k}$ 微分 + packing:`realtimeSpectrum/fragment.frag`(`disp`/`slope`/`dDxdx` 几段),四路复数信号两两打包进 4 张 MRT。
- Hermitian 伴随 $\tilde h_0^{*}(-\mathbf k)$ 的预构造:`InitialSpectrum.buildConjugate()`。
- 高斯随机复数:`InitialSpectrum.gaussianRandom()`(Box–Muller),`factor = h0Mag / sqrt(2)`。

### ⚠️ 陷阱

1. **符号 / 相位约定全链路要统一**。本项目时间演化取 $e^{+i\omega t}$,Stockham 逆变换取 $sign=+1$(`FFTStockham2D.frag`)。一旦某处把 $e^{+i}$ 写成 $e^{-i}$、或正/逆变换的 $\pm$ 搞反,波会朝反方向跑、或位移方向整体取反。**改任何复指数的符号前,先确认另外几处的约定。**

2. **DC 与 Nyquist 要特殊处理**。`InitialSpectrum.generate()` 里:$\mathbf k=0$(DC)直接跳过置零;三个 Nyquist 点 $(0,\tfrac N2),(\tfrac N2,0),(\tfrac N2,\tfrac N2)$ 的虚部强制置 0。原因:这些点是自己的共轭伴随,虚部非零会破坏实数性,IFFT 后冒出虚假高频。漏了这步,海面会有固定花纹。

3. **高斯复数的 $1/\sqrt2$ 别丢**。$\tilde h_0$ 的实部虚部各是方差 1 的高斯,$1/\sqrt2$ 让复振幅的总能量回到 $\lvert\tilde h_0\rvert^2$。丢了它,整体波高会差 $\sqrt2$ 倍——不会崩,但"按物理参数算出来的高度"对不上。

4. **注释会骗人,以代码为准**。`InitialSpectrum.generate()` 和 `realtimeSpectrum/fragment.frag` 里都留着**自相矛盾的旧注释**(一处说 `kx` 绑 `n`、一处说绑 `m`),那是轴 bug 修复前的残留。当前代码用的是"修复后标准约定"(`kx ← m ← tex.x`)。读这两个文件时**别信注释,信赋值语句**;轴约定的权威说明在 postmortem 的"约定速查表"。

---

## §6 理论 → 代码 陷阱速查表 (Gotcha Cheat-Sheet)

| #   | 陷阱                   | 在哪                                                                       | 一句话记牢                                           |
| --- | ---------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | $1/N^2$ 归一化别重复加 | `FFTStockham2D.frag` 故意省 / `JONSWAPSpectrum` 用 $(\Delta k)^2$ 折进振幅 | 归一化在频谱里,不在 IFFT 里                          |
| 2   | 周期平铺 / 频谱截断    | 离散 $\mathbf k$ 本质 + `kMin/kMax`                                        | 重复花纹是离散宿命,靠 cascade 不靠调参               |
| 3   | 两处色散不一致(bug)    | 演化用纯深水 / 谱用 tanh 深水                                              | 水深只改谱形不改波速;修复提示见 §3                   |
| 4   | choppiness 过大折叠    | `packedAssembly` Jacobian                                                  | $\alpha$ 是艺术量,$\det J<0$ 即破碎                  |
| 5   | 法线要 Eulerian 修正   | `packedAssembly` `slopeX_corr`                                             | 忘了除 $(1+\alpha\partial_xD_x)$,choppy 越强法线越错 |
| 6   | 复指数符号约定         | `realtimeSpectrum` $e^{+i\omega t}$ / `FFTStockham2D` `sign`               | 改一处符号先查另外几处                               |
| 7   | DC / Nyquist 特判      | `InitialSpectrum.generate`                                                 | 漏了会冒固定高频花纹                                 |
| 8   | 高斯 $1/\sqrt2$        | `InitialSpectrum` `factor`                                                 | 丢了波高差 $\sqrt2$ 倍                               |
| 9   | 注释自相矛盾           | `InitialSpectrum` / `realtimeSpectrum` 旧注释                              | 信赋值,不信注释;轴约定查 postmortem                  |
| 10  | 跨文件轴约定           | 全链路                                                                     | 单步对称 ≠ 全局对称(详见 postmortem)                 |

---

## §7 相关文件路径 (File Map)

| 概念                                      | 文件 · 函数/区域                                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 初始谱 $h_0$ / Hermitian / 随机数         | `src/simulation/ocean/fft/InitialSpectrum.ts` · `generate` / `buildConjugate` / `gaussianRandom`         |
| 谱振幅 / $(\Delta k)^2$ 归一化 / 色散导数 | `src/simulation/ocean/spectrums/JONSWAPSpectrum.ts` · `calculateH0Magnitude` / `calDispersionDerivative` |
| 时间演化 + $i\mathbf k$ 微分 + packing    | `src/shaders/water/fftOcean/compute/realtimeSpectrum/fragment.frag`                                      |
| GPU IFFT(Stockham,1/N² 省略说明)          | `src/shaders/water/fftOcean/compute/fftStockham/FFTStockham2D.frag`                                      |
| choppiness / 斜率修正 / Jacobian / foam   | `src/shaders/water/fftOcean/compute/packedAssembly/fragment.frag`                                        |
| 顶点位移消费                              | `src/shaders/water/fftOcean/vertex-multi-layers.vert`                                                    |
| 内存布局 `real[n*N+m]`                    | `src/simulation/ocean/fft/ComplexBuffer.ts`                                                              |
| 轴约定 bug 复盘                           | `src/simulation/ocean/fft/postmortem-fft-axis-misalignment.md`                                           |

---

> **写给未来的自己**:这篇是"为什么"和"坑在哪",不是"怎么跑"。每次回来改 FFT,先扫一遍 §6 速查表——十有八九你要踩的坑已经在表里了。
