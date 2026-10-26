# dsh-model-quick-selector

[![version](https://img.shields.io/badge/version-2.3.0-8b5cf6)](#) [![license](https://img.shields.io/badge/license-MIT-4d93f8)](LICENSE)

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）用的**模型快速选择 + Codex 风格推理等级滑条**。

它只做三件事，全部挂在 DSH 官方的模型席与模型菜单上，**不新增输入框里的常驻控件**：

| # | 做什么 | 怎么触发 |
|---|---|---|
| 1 | **挑模型**：从自己的常用模型里选，顺序自己排 | 模型菜单右上角的**设置图标** → 设置菜单 |
| 2 | **切模型**：在常用模型之间快速切换 | 在模型席上**竖向**拖动 → 松手 |
| 3 | **换推理等级**：一档一色、越往右越"通电" | 在模型菜单「推理等级」那一行拖动，或直接在模型席上**左右**拖动 |

菜单与面板里的文案**跟随 DSH 的语言设置**（中文 / English），切换语言即时生效，不用刷新。

---

## 快速选择模型

### 设置菜单（模型菜单右上角的图标）

点开官方模型菜单，顶部会多出一条空带、右端是一个**设置图标** —— 点它打开**一个**设置菜单：
一级是"快速选择模型"，二级（子菜单）是"动画设置"。**右键不再有任何设置入口**，包括滑条上。

```
快速选择模型
在模型按钮上竖向拖动即可在这些模型间切换。

已选（拖动排序）
  ⠿ 1. Claude Opus 5.5                              ×
  ⠿ 2. Claude Haiku 5.5                             ×
  ⠿ 3. deepseek-v4.1-flash                          ×

全部模型
  ☐ DeepSeek-V4.1-Flash                 DeepSeek Account
  ☑ deepseek-v4.1-flash                 ollama
  ☑ Claude Haiku 5.5                    Claude (Subscription)
```

- 勾选即加入（排在末尾），取消勾选即移除；上半部分可以**上下拖动排序**（松手才保存）。
- "动画设置 ›"进入二级页：动画效果 / 已到达档位的刻度点，改动即时生效并记住；"‹ 返回"回到一级页。
- 菜单位置：贴在模型面板**右侧**，右边放不下就翻到**左侧**；顶端与面板对齐，高度受视口底边限制
  （超了菜单内部滚动）。面板已经被卸载（矩形读出来全 0）时**不弹** —— 绝不跑到窗口左上角。
- 存储是**全局一份**：宿主 `Config.quickModels`（volatile 字段）经官方 `configForms` 读写，
  落在当前 profile 的 `cordis.patch.yml` 里 —— 与其它用户设置同一处，换项目不变、重启后仍在。
- 目录里暂时下线的模型**不显示**，但不会从存储里删掉；模型回来后照常出现。

### 选择列表（竖向拖动）

| 项目 | 行为 |
|---|---|
| 触发 | 在模型席按钮上按住后**竖向**移动超过 6px（`SEAT_DRAG_SLOP_PX`）且竖向位移大于横向位移；横向先超过 6px 则走"换档"手势 |
| 展开位置 | 以按下点为中心，**当前模型那一行正对指针**；整体夹进视口 |
| 高亮 | 指针落在哪一行就高亮哪一行；指针在列表外（含上下内距）时高亮消失 |
| 提交 | **只在松手时**提交：松手落在哪一行就切到哪个模型；落在列表外 / Esc / 指针取消 = 取消，什么都不改 |
| 只换模型 | 本菜单**没有**档位滑条、没有 ‹ › 箭头、行里只有模型名；提交的 selection 不含 `reasoningEffort`，推理等级由宿主自己决定 |
| 同模型 | 松手落在当前模型那一行 = 没有要改的设置，**一次写入都不发** |
| 点击 | 位移在 6px 以内的普通点击完全不受影响（照旧开关官方菜单）；真正拖过才吞掉松手后那一次 click |

列表**不接任何常驻控件**：它只在手势进行中出现，松手即消失。

---

## 推理等级滑条

### 怎么用

1. **在菜单里拖**：点开模型菜单，「推理等级」那一行下面就是滑条 —— 跟手连续运动，
   **拖过档位边界就即时写回**（与官方菜单同一写入口）。
2. **在模型席上左右拖**（不用点开菜单）：按住模型席按钮向右拖 = 升档、向左拖 = 降档，
   席上方弹出一条**档位条**实时显示拖到了哪一档，松手落地。
3. **动画设置**在同一块设置菜单的二级页里（模型菜单右上角图标 → 动画设置），改动即时生效并记住。

它不新增入口：**直接改造官方模型菜单里的「推理等级」那一行** ——
那一行被加高上下内距、允许折行，滑条作为第二行铺满整行宽度；拖到最高档时整条轨道亮起紫色能量层。

```
点开官方模型菜单后：
┌────────────────────────────────────┐
│ 模型             DeepSeek-V41-Flash › │   ← 官方原样
├────────────────────────────────────┤
│ 推理等级                       Max › │   ← 官方原样（label / value / chevron 一个没动）
│ ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │   ← 插件注入的滑条（这一行因此被加高）
└────────────────────────────────────┘
输入框工具行：**不加任何东西**（没有胶囊、没有浮层）
```

### 模型席拖动换档

| 项目 | 行为 |
|---|---|
| 触发 | 在模型席按钮上按住后**水平**移动超过 6px 且水平位移大于竖向位移；竖向先超过 6px 则整次手势作废（交给页面滚动） |
| 方向 | 档位按模型目录 `reasoning.efforts` 的顺序排列（DeepSeek 即 Off → Low → High → Max）：**右 = 往后（更高）**，**左 = 往前（更低）** |
| 步长 | 每拖 `(160 − 28) ÷ (档位数 − 1)` px 换一档（4 档模型 = 44px），四舍五入到最近档；旋钮与指针 1:1 移动 |
| 边界 | 拖过最低/最高档就**停在那一档**，不回绕 |
| 档位条 | 只在拖动中出现，贴在模型席上方；档位名、填充、能量、星空、刻度与菜单里的滑条**同一套渲染** |
| 写回 | 与菜单滑条同一条管道：`directory.select({ provider, model, reasoningEffort })`（拖动中 120ms 降频、同档去重，松手立即落地） |
| 点击 | 位移在 6px 以内的普通点击完全不受影响；只有真正拖过，才吞掉松手后那一次 click |
| 不生效 | 会话锁定、模型席禁用、模型档位少于 2 个、档位还没加载 |

### 设置项（设置菜单 → 动画设置）

| 设置项 | 可选 | 说明 |
|---|---|---|
| **动画效果** | **快速动画** / 简洁动画 / 完整动画 | 三种**都不受系统「减少动态效果」影响**。**快速**复刻 Codex 桌面版手感 —— 旋钮**不跟手**、停在档位格上，指针越过 1/3 档距才切下一格（后退要退回 2/3，带滞回），**约 70~85ms 吸附到位且无回弹**；**简洁**更干脆；**完整**最跟手、惯性更长 |
| **已到达档位的刻度点** | 亮白显示 / 与未到达同色 / 隐藏 | 控制轨道上那些定位小点的可见性 |
| **恢复默认** | — | 按 `SETTINGS_SCHEMA` 的默认值写回 |

### 观感

- **颜色由位置连续驱动**：填充是 `linear-gradient(90deg, 蓝, 当前位置的颜色)` ——
  左端恒为蓝、右端是当前位置的颜色，所以 high 档自然呈现"左蓝右紫"，越往右越深。
- **能量层**（紫色星云 + 扫光）在第二档以前是 0，左半段是干净的蓝；
  宽度只覆盖已填充那一段，档位右边没到达的部分不会出现能量条。
- **Off 档保持官方灰**：不写内联色（内联色只给非 Off 档），能量也是 0。
- **星空**：22 颗确定性伪随机的星尘，整轨横穿、亮度随机、速度随位置变化
  （MAX 档 1.5s / high 档 3s / 第二档附近约 8.6s）；高度是随机排列的等距槽位并与相位解耦，
  相邻相位的两颗至少差 28% 轨道高，不会并成一坨。
  **想彻底不聚集**把 `STARFIELD_DURATION_SPREAD` 设成 0（代价是所有星同速）。
- **官方那一行的档位文字**（"Max" / "High"）与收起态的模型席按钮同样着色，
  终点色是照着对比度挑的（白底 4.23:1、深色底 4.02:1）；文字内容一个字都不碰。
- **`prefers-reduced-motion`**：放缓而不是冻住（粒子周期 ×2.6），滑条的 `title` 里会说明原因。
- 配色跟随主题：轨道底色用 `--dsw-alias-border-l1`，浅色/深色都自动跟随。

### 旋钮几何

旋钮是**正圆，直径 = 轨道高度**（`TRACK_HEIGHT = KNOB_SIZE = 28px`），圆心只在 `[14px, 宽度 − 14px]` 之间移动：

```
left = calc(14px + pct × (100% − 28px))     ← 旋钮、填充终点、刻度共用这一个几何
```

所以两端圆永远是完整的圆（早期版本圆心会跑到圆角外，被 `overflow:hidden` 切出平边）。
指针映射用同一套内缩几何，拖到最左/最右必定命中端点档位。

---

## 安装

本插件**零运行时依赖、无构建步骤**：`lib/client.js` 就是发布产物，解开即可装。

### 压缩包 / 源码目录

1. **DSH Desktop**：**设置 → 插件 → 添加插件** → 填**插件目录的绝对路径**（或 `github:<用户名>/<仓库>`）
   → 安装 → **完全退出并重开** DSH Desktop。
2. **命令行**（只有非 desktop profile 能这么装）：

   ```bash
   dsh plugin --profile <你的 profile> add link:"<插件的绝对路径>"
   ```

   `desktop` 是 Electron 保留 profile，命令行会被直接拒绝
   （`error: profile "desktop" is managed exclusively by the Electron application`）。

3. **脚本**（desktop profile 且设置里没有「插件」面板时，Windows）：

   ```bat
   install.cmd                    :: 装进 desktop
   install.cmd -Profile tui       :: 装进别的 profile
   install.cmd -Uninstall         :: 卸载
   ```

   `install-profile.ps1` 做四件事：备份 profile 的 `package.json` → 加一条 `link:` 依赖 →
   把包名追加进 `dsh.profile.bundles` → 在 profile 的 `node_modules` 下建链接
   （Windows 用 junction，其它平台用符号链接），最后校验这三项都成立。

> **npm：尚未发布。** 这个仓库目前只发行源码与压缩包；`package.json` 已去掉 `"private"`，
> 随时可以 `npm publish`。

### 本机两个实例（作者自用）

```bash
node scripts/install-instances.sh   # macOS：装进 "DSH" 与 "remote" 两个 profile 并清掉旧包
```

（脚本里写死了这两个 profile 的路径，换机器请按上面的通用步骤装。）

---

## 打包与分享

```bash
npm pack        # -> dsh-model-quick-selector-<version>.tgz（按 package.json 的 files 白名单）
npm run pack    # Windows：额外产出 dist/dsh-model-quick-selector-<version>.zip
```

产物里包含 `lib/`、`locale/`、`cordis.patch.yml`、`screenshots.json`、安装脚本、`test/`、`preview/`
与 `README.md` —— **不含** `node_modules`、`dist`、`.git`。接收方不需要 `pnpm install`。

> 若要让 DSH 面板从 GitHub 直接装，把**本目录的内容**推到仓库根（`package.json` 必须在仓库根）。

---

## 它怎么工作（两半）

| 半边 | 干什么 |
|---|---|
| `lib/index.js`（宿主） | 声明 `Config.quickModels` + 一次客户端产物静态核对。存在的唯一理由是让本包成为 cordis 树上的一行，否则 `dsh.client` 的 bundle 不会被扫进启动图 |
| `lib/client.js`（客户端） | 一个不可见锚点（注册进 `conversation.input.right`，用来拿 `sessionId` 与 `ctx`）+ **DOM 桥** + 滑条（portal 进官方那一行）+ 模型席手势 + 快速选择列表/面板 |

### DOM 桥依赖的官方锚点（全部是**语义属性**，不是哈希 class）

| 锚点 | 官方产物里的形状 |
|---|---|
| 席：`button[aria-haspopup="menu"][aria-expanded="true"]` | `<button aria-haspopup="menu" aria-expanded={open} aria-controls={…}>` |
| 菜单：席的 `aria-controls` → `getElementById(…)` | 菜单 `id={…-menu}`，portal 到 body |
| 目标行：菜单里 `button[role="menuitem"]` 的**第 2 个** | 根面板恰好两行（模型 / 推理等级）；子面板用 `menuitemradio`，所以 `menuitem` 唯一标识根面板 |
| 归属判定：从自己的锚点向上找 `[data-composer-card]` | composer 卡片带这个标记；打开的那颗席必须在**自己的** composer 里 |

**只改那一行**：写 4 个内联样式（`height:auto` / `flex-wrap:wrap` / `padding-block:10px`）+ append 一个容器；
关菜单或插件卸载时逐个还原。不碰官方 class、不改官方文字与 chevron。

**设置入口**：往菜单卡里 `insertBefore` 一条 28px 高的空带（`data-ces-part="menu-head"`），右端放设置图标
（`data-ces-part="menu-gear"`）。它是菜单卡的第一个子节点，所以视觉上就是"面板顶部多出来的那块"；
官方重渲染只增删它自己的节点，带子留在原处，万一被挤下去下一次扫描会挪回最前。
点击图标时**在 pointerdown 那一刻**记下菜单卡的矩形，点击回调用它给设置菜单定位 ——
官方可能在任何后续事件里把菜单卡卸载掉（那时 `getBoundingClientRect()` 全是 0）。
官方菜单是"测量后固定定位"的，插件加高那一行后会派发一次 `resize`，官方自己会重新夹取位置。

**fail-open**：任何一步认不出（没有 `aria-controls`、不是根面板、不是自己的 composer、
目录里没有档位、会话作用域没就绪）就**什么都不做** —— 官方菜单保持原样。

### 数据路径（只用官方公开面）

| 用途 | 接口 |
|---|---|
| 读档位 / 目录 | `directoryFor(sessionId).store.getSnapshot()` → `groups[].models[].reasoning.efforts` |
| 写档位 / 换模型 | `directory.select({ provider, model[, reasoningEffort] })`（与官方菜单同一写入口） |
| 订阅 | `store.subscribe()` + `React.useSyncExternalStore` |
| 读/写快速选择列表 | `configForms.get("model-quick-selector")` → volatile 字段 `quickModels` |

### 多语言（跟随 DSH 的语言设置）

- DSH 的语言由官方 `@deepseek-ai/dsh-client-locale` 提供：用户在 **设置 → 通用 → 语言** 里选，
  选择写进当前 profile 的 `cordis.patch.yml`（设置命名空间 `locale`）；没选过时按浏览器语言定。
- 本插件把字典注册进那个服务（命名空间 `model-quick-selector`，中英两份），
  插槽条目声明 `locale: "model-quick-selector"` —— 官方会把 `t` 座位注入组件，
  并在切换语言时重渲染插槽，所以文案立即跟着变。
- 菜单、面板、aria-label、报错信息全部经 `t` 取文案；极简组合里没有 locale 服务时
  退到**同一份字典的英文表**（不会漏出写死的中文）。

---

## 稳健性

- `directoryFor()` 在会话作用域就绪前**按设计抛错** → 退避重试（60ms 起，约 9 秒）+ 自愈；
  档位数是**后到**的，桥会在档位数变化时主动重扫（DOM 不会因为 store 变化而产生 mutation）。
- 写入失败 / 超时（10s）→ 回滚到真实档位并显示原因，**不谎报成功**。
- 拖动写入有**同档位去重 + 在途合并 + 120ms 降频**：1 秒内 60 次拖动最多 3 次写回；
  松手必定落地。
- 快速选择**只在松手时写一次** `directory.select`，拖动过程中宿主里的模型与档位都不变。
- 同一行里若还留着旧包（改名前）挂的容器，会被清掉；旧包若与本包同时在场，只有一份会渲染。
- 滑条吞掉自己的 pointer/click/方向键事件，**不会误触官方那一行的 onClick**。
- 组件卸载时停掉帧循环、清掉降频定时器；桥卸载时还原那一行的样式并摘掉容器。
- 本插件**不注册任何宿主钩子、不注入消息**（测试里有 `ctx.on` 监视断言守着这一点）。

---

## 开发

无构建步骤：`lib/client.js` 就是发布产物（手写、可读，`require("react")` / `require("react-dom")`
走宿主模块表的平台种子词）。

```bash
npm test          # 三个离线套件，共 1236 条断言
npm run preview   # 生成 preview/panel.html（可拖动、切浅深色、切 4/2/6 档模型）
```

| 套件 | 覆盖 |
|---|---|
| `test/client.test.mjs` | 滑条几何/色彩/星空/注入/失败回滚/无注入回归；设置图标 + 合并菜单 + 落点边界值（[55]） |
| `test/seat-drag.test.mjs` | 模型席左右拖动换档（位移→档位、阈值、点击不被吞、档位条） |
| `test/quick-select.test.mjs` | 快速选择：设置菜单、存储、竖向选择、松手提交、列表无档位、多语言（含无 locale 的英文兜底） |

测试台 `test/harness.mjs` 里有一份**保状态**的 React 桩、够用的假 DOM（含 portal、MutationObserver、
多属性选择器）、一个**假官方菜单**（形状逐字对齐官方产物）和一个**假 locale 服务**。
本机没有可离线使用的真 React，所以渲染层是桩件驱动的；数据路径与 DOM 注入路径跑的都是真代码。

---

## 已知限制

- **需要完全重启 DSH Desktop 才生效**（客户端 bundle 在启动时注入）。
- 依赖官方菜单的 DOM 语义属性。官方若改成非 `menuitem` 结构、去掉 `aria-controls`、
  或不再用 `data-composer-card`，本插件会**静默退回"什么都不做"**（官方功能照常可用）。
- 那一行加高约 20px + 滑条 28px，菜单总高会变大；官方会自己重测位置，极小屏幕上可能贴边。
- 快速选择列表的宽度与行高是固定常量，换字号/极端小屏时会显得偏紧。
- 主题令牌缺失时回退到中性灰 + `#4d93f8` 蓝，观感可用但不如在 DSH 内贴合。
- 插件市场需要 `screenshots.json` 里列出的截图文件；本仓库里的截图来自滑条版本，
  快速选择面板暂无截图。

---

## 许可

MIT（见 `LICENSE`）。无第三方代码：闪电标/雪弗龙是自己画的路径，粒子层是自己写的 DOM/CSS。
