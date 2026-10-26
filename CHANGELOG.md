# 更新日志

所有值得用户知道的改动都记在这里。版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## 2.3.0 — 首个发行版（2026-10-26）

`dsh-model-quick-selector`（原名 `dsh-codex-effort-slider`）改名与功能合并之后的第一个发行版。
这一版把**模型快速选择**和**推理等级滑条**放进同一个插件，并按发行版标准补齐了文档、安装脚本与多语言。

### 新增

- **模型快速选择**
  - **右键模型席**打开设置面板：勾选常用模型、上下拖动排序、`×` 移除；
  - 在模型席上**竖向拖动**展开选择列表：当前模型那一行正对指针，上下移动高亮，
    松手切到指针下的模型；松手在列表外 / Esc / 指针取消 = 取消；
  - 列表存在宿主 `Config.quickModels`（volatile 字段），经官方 `configForms` 读写，
    落在当前 profile 的 `cordis.patch.yml` —— 全局一份、跨项目、重启后仍在；
    目录里下线的模型不显示、但不从存储里删除。
- **多语言**：菜单与设置面板的中英文字典注册进官方 `@deepseek-ai/dsh-client-locale`
  （命名空间 `model-quick-selector`），插槽条目声明 `locale`，文案跟随 DSH 的语言设置、
  切换即时生效；极简组合里没有 locale 服务时退回同一份字典的英文表。
- **推理等级滑条**（沿用前身包的能力）：官方菜单「推理等级」那一行的滑块、
  模型席左右拖动换档与档位条、三种动画效果、刻度点设置、诊断导出。

### 设计取舍

- **快速选择只选模型**：列表里**没有**档位滑条、没有每行档位文字、没有 `‹ ›` 箭头，
  提交的 selection 也**不含** `reasoningEffort` —— 推理等级只由滑条、官方 `Effort ›` 那一行
  和模型席左右拖动修改。
- **只在松手时提交**：拖动过程中只移动高亮，宿主里的模型与档位保持不变；
  松手落在当前模型那一行时**一次写入都不发**。
- 设置面板的提示只说这个菜单真正会做的事（切换模型），不再描述档位调整。

### 发行物料

- `README.md` 按当前功能重写（快速选择 / 滑条 / 安装 / 打包 / 多语言 / 开发 / 限制）。
- 新增本更新日志。
- `install-profile.ps1`、`install.cmd`、`preview/make-preview.mjs` 的标题与兜底包名改用新名字。
- `package.json`：版本 `2.3.0`；`files` 增加 `locale`；`dsh.client.inject` 增加
  `@deepseek-ai/dsh-client-locale`。
- 发行产物：`dsh-model-quick-selector-2.3.0.tgz`（`npm pack`）与同名 `.zip`。

### 质量

- 三个离线套件（`client` / `seat-drag` / `quick-select`）共 **1080 条断言**，全部通过。
- `npm run preview` 重新生成 `preview/panel.html`。

### 已知限制

- 需要**完全退出并重开** DSH Desktop 才生效（客户端 bundle 在启动时注入）。
- 尚未发布到 npm；本发行以源码 + 压缩包形式提供。
