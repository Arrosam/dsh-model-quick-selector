/**
 * dsh-model-quick-selector — 宿主半边
 *
 * 功能都在客户端半边（`lib/client.js`）。宿主半边做两件事：
 *   1. **让这个包成为 cordis 树上的一行**：`dsh.client` 的客户端 bundle 是靠
 *      「宿主 Loader 的条目里有这个包」被 `dsh-client-modules` 扫出来、编进
 *      `window.__DSH_BOOT__` 的。没有宿主条目，客户端产物永远不会被加载。
 *   2. **声明快速选择模型列表的存储**：`quickModels` 是一个 `.volatile()` 字段。
 *      官方设置服务（dsh-settings）只把 volatile 字段开放给浏览器读写，写入落进当前
 *      profile 的 `cordis.patch.yml` 里这一行的 config —— 也就是其它用户设置所在的同一处。
 *      所以列表是**全局一份**（与工作区/项目无关）、**重启后仍在**；客户端经 `configForms` 读写它。
 *      宿主自己不读这个值（它只影响浏览器里的手势），所以这里只声明、不消费。
 *
 * 纪律：apply() 绝不抛错；不声明任何 inject（声明一个从未被 provide 的服务会让 fiber 停在 PENDING）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import z from "@deepseek-ai/schemastery";

const PACKAGE_ID = "dsh-model-quick-selector";

/** 一个快速选择条目：模型由 provider id + model id 两个官方 id 唯一确定（显示名只用于展示）。 */
const QuickModel = z.object({
  provider: z.string().required(),
  model: z.string().required(),
});

export const Config = z.object({
  quickModels: z.array(QuickModel).default([])
    .description("Models offered by vertical drag on the model selector, in the order shown.").volatile(),
});

/**
 * 静态核对客户端产物：只读文件、查关键标志，**不执行**产物。
 * 任何问题只告警，绝不阻断启动（这份产物坏了，坏的也只是那一块控件）。
 */
function auditClientBundle(log) {
  try {
    const bundle = readFileSync(fileURLToPath(new URL("./client.js", import.meta.url)), "utf8");
    const problems = [];
    if (!bundle.includes(`id: "${PACKAGE_ID}"`) && !bundle.includes(`id:"${PACKAGE_ID}"`)) problems.push("bundle id 不匹配");
    if (!bundle.includes("__ModuleLoader__.load")) problems.push("不是模块加载器 bundle");
    if (!bundle.includes("return module.exports")) problems.push("工厂没有交出 exports");
    if (!bundle.includes("conversation.input.right")) problems.push("没有声明目标插槽");
    if (!/exports\.apply\s*=/.test(bundle)) problems.push("没有导出 apply");
    if (problems.length > 0) {
      log(`客户端产物 lib/client.js 检查未通过（界面可能不会出现功能）：${problems.join("；")}`);
      return;
    }
    log(`客户端产物 lib/client.js 就绪（${Buffer.byteLength(bundle, "utf8")} 字节，静态检查通过）`);
  } catch (error) {
    log(`客户端产物 lib/client.js 不可读（界面不会出现功能）：${String(error)}`);
  }
}

/** @param ctx 宿主 cordis 上下文（只用它的 logger） */
export function apply(ctx) {
  try {
    const candidate = ctx?.logger;
    const sink = typeof candidate === "function" ? candidate(PACKAGE_ID) : candidate;
    const log = (message) => {
      try {
        if (sink && typeof sink.info === "function") sink.info(`[${PACKAGE_ID}] ${message}`);
        else console.info(`[${PACKAGE_ID}] ${message}`);
      } catch {
        /* 连日志都不能抛 */
      }
    };
    auditClientBundle(log);
  } catch {
    /* 审计本身失败也必须让 apply 静默成功 */
  }
}

export default { apply, Config };
