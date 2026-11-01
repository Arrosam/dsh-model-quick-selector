/**
 * dsh-model-quick-selector — black-box tests for the quick-select model list.
 *
 * Run: `node test/quick-select.test.mjs` (exit 0 = every assertion passed).
 *
 * Contract under test (from the feature request, not from lib/client.js):
 *   Q1 the settings gear in the official Model select popover opens one panel; ticking models adds them
 *      to the list (in tick order), unticking removes them, and dragging a chosen model vertically
 *      reorders the list. Right-clicking the seat/slider must NOT open any settings menu.
 *   Q2 the list is saved through the Host settings form (configForms entry "model-quick-selector",
 *      field "quickModels"), i.e. one global value; a fresh load reading the same form shows the same list.
 *   Q3 a vertical drag opens the expanded list ONLY when a list is set and the current model is in it;
 *      otherwise the selector behaves exactly as before (no list, click not cancelled).
 *   Q4 the expanded list shows the models in the user's order; each row is only the model name.
 *   Q5 inside the list, vertical movement moves the highlight — and NOTHING is written while dragging
 *      (no model, no effort); horizontal movement changes nothing in this menu.
 *   Q6 releasing over a row selects that model — and only that model (the effort is left alone).
 *   Q7 releasing outside the list (or pointercancel / Escape) cancels: model and effort stay unchanged.
 *   Q8 a plain click on the selector is untouched (the seat's own horizontal effort drag still works).
 *   Q10 the list is only plain rows: no slider above it, no slider inside a row, no effort word.
 *   Q11 every string in the list and the settings panel follows the DSH language setting.
 *
 * Techniques: Equivalence Partitioning (in list / not in list / empty list), Boundary Value Analysis
 * (slop vs slop+1, row edges, list edge), State Transitions (idle → pending → picking → committed/cancelled),
 * Decision Table (language × surface).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createDocument, createFakeHost, createFakeLocale, createOfficialMenu, loadBundle, settle } from "./harness.mjs";

const BUNDLE = fileURLToPath(new URL("../lib/client.js", import.meta.url));

let passed = 0;
let failed = 0;
function ok(condition, label) {
  if (condition) { passed += 1; console.log("  ok   " + label); }
  else { failed += 1; console.log("  FAIL " + label); }
}
function eq(actual, expected, label) {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  ok(same, same ? label : label + " (expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual) + ")");
}
function section(title) { console.log("\n[" + title + "]"); }

/* ── catalog: three models, one provider ── */
const lv = (id, name) => ({ id, name });
const FLASH = { id: "flash", name: "deepseek-v4.1-flash", reasoning: { defaultEffort: "high", efforts: [lv("off", "Off"), lv("low", "Low"), lv("high", "High"), lv("max", "Max")] } };
const OPUS = { id: "opus", name: "Claude Opus 5.5", reasoning: { defaultEffort: "medium", efforts: [lv("low", "Low"), lv("medium", "Medium"), lv("high", "High")] } };
const HAIKU = { id: "haiku", name: "Claude Haiku 5.5", reasoning: { defaultEffort: "low", efforts: [lv("low", "Low"), lv("medium", "Medium"), lv("high", "High")] } };
const MODELS = [FLASH, OPUS, HAIKU];
const P = "claude";
const item = (model) => ({ provider: P, model: model.id });

const ORIGIN = { x: 640, y: 400 };
const VIEWPORT = { width: 1280, height: 800 };

/** A Host settings form double: holds the value, records writes, notifies like the real mirror. */
function fakeForm(initial) {
  let snapshot = { status: "ready", value: { quickModels: initial }, revision: 1, writable: true };
  const listeners = new Set();
  const sets = [];
  return {
    sets,
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async set(field, value) {
      sets.push([field, value]);
      snapshot = { ...snapshot, value: { ...snapshot.value, [field]: value }, revision: snapshot.revision + 1 };
      for (const l of [...listeners]) l();
      return true;
    },
  };
}

const live = [];

async function setup({ list = [], current = FLASH, effort, form, locale } = {}) {
  const document = createDocument();
  const name = (current.reasoning.efforts.find((e) => e.id === (effort ?? current.reasoning.defaultEffort)) || {}).name;
  const menu = createOfficialMenu(document, { modelLabel: current.name, effortLabel: name, open: false });
  const bundle = loadBundle(BUNDLE, document, {});
  const host = createFakeHost({
    model: current,
    effort,
    locale,
    // Host round trip: a selection without reasoningEffort only moves the model — the effort is kept.
    select: (selection, store) => {
      const previous = store.getSnapshot().current;
      const nextEffort = selection.reasoningEffort === undefined ? previous.reasoningEffort : selection.reasoningEffort;
      store.set({
        ...store.getSnapshot(),
        current: {
          provider: selection.provider,
          model: selection.model,
          ...(nextEffort === undefined ? {} : { reasoningEffort: nextEffort }),
        },
      });
      return { ok: true, value: undefined };
    },
  });
  host.store.set({ ...host.store.getSnapshot(), current: { ...host.store.getSnapshot().current, provider: P }, groups: [{ id: P, name: "Claude", models: MODELS }] });
  const settingsForm = form ?? fakeForm(list);
  const forms = { get: (id) => { forms.asked.push(id); return settingsForm; }, asked: [] };
  host.ctx.configForms = forms;
  bundle.plugin.apply(host.ctx);
  // The real slot outlet injects the locale seat's t; give the component the same seat when a language is set.
  const seat = { sessionId: "s-1", locked: false };
  if (locale) seat.t = locale.bind(I.QUICK_NS);
  bundle.react.mount(host.registered[0].Component, seat, menu.composer);
  const ctx = { document, menu, bundle, react: bundle.react, host, form: settingsForm, forms };
  live.push(ctx);
  await settle(); bundle.flushObservers(); await settle();
  return ctx;
}
function teardown() { while (live.length) { try { live.pop().react.unmount(); } catch {} } }

/* ── merged settings menu helpers: open the official popover first, then click its gear ── */

function gearOf(ctx) {
  const gear = ctx.document.querySelector('[data-ces-part="model-gear"]');
  if (gear === null) throw new Error("official popover has no settings gear");
  return gear;
}

/** The official Model select popover must be open for its (DOM-bridge) gear to exist. */
async function openOfficialMenu(ctx) {
  ctx.menu.seat.setAttribute("aria-expanded", "true");
  ctx.bundle.flushObservers();       // official React re-render → bridge scan
  await settle();
}

/** Click the Model-row gear and return the one body-level modal's dialog card. */
async function openSettingsModal(ctx) {
  await openOfficialMenu(ctx);
  gearOf(ctx).dispatch("click", { clientX: ORIGIN.x, clientY: ORIGIN.y, detail: 1 });
  await settle();
  return ctx.react.find("settings-card");
}

async function closeSettingsModal(ctx) {
  ctx.document.dispatch("keydown", { key: "Escape" });
  await settle();
}

/** Every visible string below a fake node (text + attribute values), for "no Chinese leaked". */
function allStrings(node) {
  const out = [];
  const walk = (item) => {
    if (item === null || item === undefined) return;
    if (item._text !== undefined) out.push(item._text);
    if (item.attributes) for (const value of item.attributes.values()) out.push(value);
    for (const child of item.children ?? []) walk(child);
  };
  walk(node);
  return out.join(" ");
}

function gesture(ctx, x0 = ORIGIN.x, y0 = ORIGIN.y) {
  const seat = ctx.menu.seat;
  const send = (type, dx, dy) => {
    const calls = { stopPropagation: 0 };
    seat.dispatch(type, { currentTarget: seat, clientX: x0 + dx, clientY: y0 + dy, button: type === "pointermove" ? -1 : 0, buttons: 1, pointerId: 1, isPrimary: true, stopPropagation() { calls.stopPropagation += 1; }, preventDefault() {} });
    return calls;
  };
  return {
    down: () => send("pointerdown", 0, 0),
    move: async (dx, dy) => { send("pointermove", dx, dy); await settle(); },
    up: async (dx, dy) => { send("pointerup", dx, dy); const c = send("click", dx, dy); await settle(); return c; },
    cancel: async (dx, dy) => { send("pointercancel", dx, dy); await settle(); },
  };
}

const rows = (ctx) => ctx.react.findAll("quick-row");
const listShown = (ctx) => ctx.react.findAll("quick-list").length;
const current = (ctx) => ctx.host.store.getSnapshot().current;
const I = loadBundle(BUNDLE, createDocument()).plugin.__internals;
const SLOP = I.SEAT_DRAG_SLOP_PX;
const ROW = I.QUICK_ROW_PX;
const STEP3 = I.seatBarStepPx(3);
const STEP4 = I.seatBarStepPx(4);

async function run(id, body) {
  try { await body(); } catch (error) { ok(false, id + " threw: " + (error && error.stack ? error.stack.split("\n").slice(0, 2).join(" | ") : error)); }
  finally { teardown(); }
}

/* ══════════════════════════════════════════════════════ */

section("P. Pure helpers");
await run("[P]", async () => {
  eq(I.toggleQuickModel([item(FLASH)], P, "opus"), [item(FLASH), item(OPUS)], "[P1] ticking appends at the end");
  eq(I.toggleQuickModel([item(FLASH), item(OPUS)], P, "flash"), [item(OPUS)], "[P2] unticking removes in place");
  eq(I.moveQuickModel([item(FLASH), item(OPUS), item(HAIKU)], 0, 2), [item(OPUS), item(HAIKU), item(FLASH)], "[P3] move first → last");
  eq(I.moveQuickModel([item(FLASH), item(OPUS)], 1, 9), [item(FLASH), item(OPUS)], "[P4] move clamps at the end");
  eq(I.normalizeQuickList([item(FLASH), item(FLASH), { provider: 1 }, null, item(OPUS)]), [item(FLASH), item(OPUS)], "[P5] normalize drops duplicates and malformed items, keeps order");
  eq(I.normalizeQuickList("junk"), [], "[P6] non-array storage → empty list");
  eq(I.reorderTargetIndex(0, ROW / 2 - 1, 3), 0, "[P7] reorder: just under half a row stays");
  eq(I.reorderTargetIndex(0, ROW / 2, 3), 1, "[P8] reorder: half a row moves one slot");
  eq(I.reorderTargetIndex(1, -10 * ROW, 3), 0, "[P9] reorder clamps at the top");
  const layout = I.quickListLayout(ORIGIN.x, ORIGIN.y, 1, 3, VIEWPORT);
  eq(I.quickRowAt(ORIGIN.x, ORIGIN.y, layout, 3), 1, "[P10] the current row sits under the press point");
  eq(I.quickRowAt(ORIGIN.x, layout.top + layout.height + 1, layout, 3), -1, "[P11] below the list → -1 (cancel)");
  eq(I.quickRowAt(layout.left - 1, ORIGIN.y, layout, 3), -1, "[P12] left of the list → -1 (cancel)");
  ok(layout.top >= 0 && layout.top + layout.height <= VIEWPORT.height, "[P13] list fits the viewport");
});

section("Q3. Vertical drag gating");
await run("[Q3]", async () => {
  for (const [label, list] of [["no list", []], ["current model not in list", [item(OPUS), item(HAIKU)]]]) {
    const ctx = await setup({ list });
    const g = gesture(ctx);
    g.down();
    await g.move(0, ROW * 2);
    eq(listShown(ctx), 0, "[Q3] " + label + ": vertical drag shows no list");
    const click = await g.up(0, ROW * 2);
    eq(click.stopPropagation, 0, "[Q3] " + label + ": click after vertical move not cancelled (unchanged behaviour)");
    eq(ctx.host.selects.length, 0, "[Q3] " + label + ": nothing selected");
    teardown();
  }
  const ctx = await setup({ list: [item(OPUS), item(FLASH), item(HAIKU)] });
  const g = gesture(ctx);
  g.down();
  await g.move(0, SLOP);
  eq(listShown(ctx), 0, "[Q3] dy = slop: still pending, no list");
  await g.move(0, SLOP + 1);
  eq(listShown(ctx), 1, "[Q3] dy = slop + 1 with current model in the list: list opens");
  await g.cancel(0, SLOP + 1);
});

section("Q4/Q5/Q6. Plain rows, highlight follows the drag, the model is written on release only");
await run("[Q4]", async () => {
  const ctx = await setup({ list: [item(OPUS), item(FLASH), item(HAIKU)], effort: "high" });   // current = FLASH (row 1)
  const g = gesture(ctx);
  g.down();
  await g.move(0, SLOP + 1);
  eq(rows(ctx).map((r) => r.getAttribute("data-model")), ["opus", "flash", "haiku"], "[Q4] rows follow the user's order");
  eq(rows(ctx).map((r) => r.getAttribute("data-current")), ["0", "1", "0"], "[Q4] current model marked in place");
  eq(rows(ctx).map((r) => r.textContent), ["Claude Opus 5.5", "deepseek-v4.1-flash", "Claude Haiku 5.5"], "[Q4] a row is only the model name");
  eq(ctx.react.findAll("quick-effort").length, 0, "[Q4] no row shows an effort word");
  await g.move(0, ROW);
  eq(rows(ctx).map((r) => r.getAttribute("data-active")), ["0", "0", "1"], "[Q5] moving down one row activates the next model");
  eq(ctx.host.selects.length, 0, "[Q5] no model written while the drag is in progress");
  await g.move(-STEP3, ROW);
  eq(rows(ctx).map((r) => r.getAttribute("data-active")), ["0", "0", "1"], "[Q5] horizontal movement does not move the highlight");
  eq(ctx.host.selects.length, 0, "[Q5] still nothing written after horizontal movement");
  const click = await g.up(-STEP3, ROW);
  eq(listShown(ctx), 0, "[Q6] list closes on release");
  eq(ctx.host.selects, [{ provider: P, model: "haiku" }], "[Q6] releasing over a row sends that model, without an effort");
  eq(current(ctx).model, "haiku", "[Q6] that model is now current");
  eq(current(ctx).reasoningEffort, "high", "[Q6] the reasoning effort is untouched (this menu does not change it)");
  eq(click.stopPropagation, 1, "[Q6] the click right after the gesture is swallowed (menu does not toggle)");
});

await run("[Q6b]", async () => {
  const ctx = await setup({ list: [item(FLASH), item(OPUS)], effort: "high" });   // current FLASH row 0, effort high (idx 2 of 4)
  const g = gesture(ctx);
  g.down();
  await g.move(0, SLOP + 1);
  await g.move(STEP4, SLOP + 1);
  eq(ctx.host.selects.length, 0, "[Q6b] horizontal drag in the list writes nothing while it runs");
  await g.up(STEP4, SLOP + 1);
  eq(ctx.host.selects.length, 0, "[Q6b] releasing on the current row writes nothing (no effort to set)");
  eq(current(ctx).reasoningEffort, "high", "[Q6b] effort unchanged");
  eq(listShown(ctx), 0, "[Q6b] the list still closes");

  const ctx2 = await setup({ list: [item(FLASH), item(OPUS)], effort: "high" });
  const g2 = gesture(ctx2);
  g2.down();
  await g2.move(0, ROW);              // row 1 = opus
  await g2.move(2 * STEP3, ROW);      // a full track's travel, still inside the list width
  ok(2 * STEP3 < I.QUICK_LIST_WIDTH_PX / 2, "[Q6b] the drag stays inside the list");
  eq(ctx2.host.selects.length, 0, "[Q6b] dragging across models writes nothing before release");
  await g2.up(2 * STEP3, ROW);
  eq(ctx2.host.selects, [{ provider: P, model: "opus" }], "[Q6b] only the model is sent on release");
  eq(current(ctx2).reasoningEffort, "high", "[Q6b] the effort is untouched");
});

section("Q7. Cancel paths keep model and effort");
await run("[Q7]", async () => {
  const list = [item(OPUS), item(FLASH), item(HAIKU)];
  const before = { provider: P, model: "flash", reasoningEffort: "low" };
  for (const [label, finish] of [
    ["release below the list", (g) => g.up(0, 6 * ROW)],
    ["release beside the list", (g) => g.up(I.QUICK_LIST_WIDTH_PX, ROW)],
    ["pointercancel", (g) => g.cancel(0, ROW)],
  ]) {
    const ctx = await setup({ list, effort: "low" });
    const g = gesture(ctx);
    g.down();
    await g.move(0, ROW);
    await g.move(0, label === "release beside the list" ? ROW : 6 * ROW);
    await finish(g);
    eq(listShown(ctx), 0, "[Q7] " + label + ": list closed");
    eq(ctx.host.selects.length, 0, "[Q7] " + label + ": nothing written");
    eq(current(ctx), before, "[Q7] " + label + ": model and effort unchanged");
    teardown();
  }
  const ctx = await setup({ list, effort: "low" });
  const g = gesture(ctx);
  g.down();
  await g.move(0, ROW);
  ctx.document.dispatch("keydown", { key: "Escape" });
  await settle();
  eq(listShown(ctx), 0, "[Q7] Escape closes the list");
  await g.up(0, ROW);
  eq(ctx.host.selects.length, 0, "[Q7] release after Escape writes nothing");
});

section("Q8. Plain click and horizontal drag unchanged");
await run("[Q8]", async () => {
  const ctx = await setup({ list: [item(FLASH), item(OPUS)] });
  const g = gesture(ctx);
  g.down();
  const click = await g.up(0, 0);
  eq(click.stopPropagation, 0, "[Q8] plain click passes through");
  eq(listShown(ctx), 0, "[Q8] no list on a plain click");
  const h = gesture(ctx);
  h.down();
  await h.move(STEP4, 0);
  eq(ctx.react.findAll("seatbar").length, 1, "[Q8] horizontal drag still shows the effort bar");
  eq(listShown(ctx), 0, "[Q8] horizontal drag does not open the quick list");
  await h.up(STEP4, 0);
  await new Promise((r) => setTimeout(r, 200)); await settle();
  eq(current(ctx).reasoningEffort, "max", "[Q8] horizontal drag still changes effort");
});

section("Q1/Q2. Settings panel (opened by the gear): pick, reorder, save, reload");
await run("[Q1]", async () => {
  const ctx = await setup({ list: [] });
  // The gear lives in the official popover, so open it first. A right-click must not open anything.
  await openOfficialMenu(ctx);
  ctx.menu.seat.dispatch("contextmenu", { preventDefault() {}, stopPropagation() {} });
  await settle();
  eq(ctx.react.findAll("quick-panel").length, 0, "[Q1] right-click the model seat no longer opens the old panel");
  eq(ctx.react.findAll("settings-modal").length, 0, "[Q1] right-click the model seat does not open the modal either");
  const panel = await openSettingsModal(ctx);
  ok(panel !== null, "[Q1] clicking the gear opens the modal");
  eq(panel.getAttribute("data-pane"), "root", "[Q1] it opens on the quick-model pane");
  eq(panel.getAttribute("role"), "dialog", "[Q1] the modal card is a dialog");
  const modal = ctx.react.find("settings-modal");
  ok(modal !== null, "[Q1] the modal has an outer .mqs-modal backdrop");
  eq(ctx.document.body.querySelectorAll('[data-ces-part="settings-modal"]').length, 1, "[Q1] exactly one body-level modal");
  eq(ctx.react.findAll("quick-panel").length, 0, "[Q1] the old side-panel element is gone");
  eq(ctx.menu.menu.contains(modal), false, "[Q1] the modal is portaled outside the official popover");
  eq(ctx.react.findAll("quick-option").map((o) => o.getAttribute("data-model")), ["flash", "opus", "haiku"], "[Q1] modal lists every catalog model");
  const tick = async (model) => {
    const input = ctx.react.findAll("quick-option").find((o) => o.getAttribute("data-model") === model).querySelector('[data-ces-part="quick-option-input"]');
    input.fire("onChange", {});
    await settle();
  };
  await tick("haiku"); await tick("flash"); await tick("opus");
  eq(ctx.form.sets.at(-1), ["quickModels", [item(HAIKU), item(FLASH), item(OPUS)]], "[Q1] ticks saved to the settings form in tick order");
  eq(ctx.forms.asked.every((id) => id === "model-quick-selector"), true, "[Q2] stored in the global settings entry 'model-quick-selector'");
  eq(ctx.react.findAll("quick-chip").map((c) => c.getAttribute("data-model")), ["haiku", "flash", "opus"], "[Q1] chosen list shown in order");
  await tick("flash");
  eq(ctx.form.sets.at(-1)[1], [item(HAIKU), item(OPUS)], "[Q1] unticking removes it");
  await tick("flash");
  // drag the first chip (haiku) down two rows → last
  let chip = ctx.react.findAll("quick-chip")[0];
  chip.fire("onPointerDown", { button: 0, clientY: 100, pointerId: 3 });
  await settle();
  chip = ctx.react.findAll("quick-chip").find((c) => c.getAttribute("data-dragging") === "1");
  chip.fire("onPointerMove", { clientY: 100 + 2 * ROW });
  await settle();
  eq(ctx.react.findAll("quick-chip").map((c) => c.getAttribute("data-model")), ["opus", "flash", "haiku"], "[Q1] live preview while dragging");
  chip = ctx.react.findAll("quick-chip").find((c) => c.getAttribute("data-dragging") === "1");
  chip.fire("onPointerUp", { type: "pointerup", clientY: 100 + 2 * ROW });
  await settle();
  eq(ctx.form.sets.at(-1)[1], [item(OPUS), item(FLASH), item(HAIKU)], "[Q1] reorder saved");
  const remove = ctx.react.findAll("quick-chip-remove")[0];
  remove.fire("onClick", {});
  await settle();
  eq(ctx.form.sets.at(-1)[1], [item(FLASH), item(HAIKU)], "[Q1] × removes from the list");
  await closeSettingsModal(ctx);
  eq(ctx.react.findAll("settings-modal").length, 0, "[Q1] Escape closes the modal");
  ctx.react.find("track").dispatch("contextmenu", { preventDefault() {}, stopPropagation() {} });
  await settle();
  eq(ctx.react.findAll("settings-modal").length, 0, "[Q1] right-click the effort slider never opens the modal");
  eq(ctx.document.documentElement.listeners.has("contextmenu"), false, "[Q1] no document-level contextmenu handler is installed");

  // Q2: a fresh load (app restart, another project) reading the same Host form sees the same list.
  const saved = ctx.form;
  teardown();
  const again = await setup({ form: saved, current: HAIKU });
  const g = gesture(again);
  g.down();
  await g.move(0, SLOP + 1);
  eq(rows(again).map((r) => r.getAttribute("data-model")), ["flash", "haiku"], "[Q2] after reload the list and order are the same");
  await g.cancel(0, SLOP + 1);
});

section("Q9. Without the settings service the selector works as before");
await run("[Q9]", async () => {
  const ctx = await setup({ list: [item(FLASH)] });
  ctx.host.ctx.configForms = undefined;
  teardown();
  const document = createDocument();
  const menu = createOfficialMenu(document, { modelLabel: FLASH.name, effortLabel: "High", open: false });
  const bundle = loadBundle(BUNDLE, document, {});
  const host = createFakeHost({ model: FLASH });
  bundle.plugin.apply(host.ctx);
  bundle.react.mount(host.registered[0].Component, { sessionId: "s-2", locked: false }, menu.composer);
  live.push({ react: bundle.react });
  await settle(); bundle.flushObservers(); await settle();
  const seat = menu.seat;
  const ev = (type, dx, dy) => seat.dispatch(type, { currentTarget: seat, clientX: 640 + dx, clientY: 400 + dy, button: 0, buttons: 1, pointerId: 1, isPrimary: true, stopPropagation() {}, preventDefault() {} });
  ev("pointerdown", 0, 0); ev("pointermove", 0, 40); await settle();
  eq(bundle.react.findAll("quick-list").length, 0, "[Q9] no configForms → no quick list, no crash");
  ev("pointerup", 0, 40); await settle();
});

section("Q10. The list is only plain rows — no slider, no effort anywhere");
await run("[Q10]", async () => {
  const ctx = await setup({ list: [item(OPUS), item(FLASH), item(HAIKU)] });   // current = FLASH (row 1), effort high
  const g = gesture(ctx);
  g.down();
  await g.move(0, SLOP + 1);

  // The whole list: three rows, each holding exactly the model name.
  const list = ctx.react.find("quick-list");
  eq(list.children.length, 3, "[Q10] the list holds the rows and nothing else");
  eq(rows(ctx).length, 3, "[Q10] three plain rows");
  eq(rows(ctx).map((r) => r.children.length), [1, 1, 1], "[Q10] each row holds exactly one node");
  eq(rows(ctx).map((r) => r.textContent), ["Claude Opus 5.5", "deepseek-v4.1-flash", "Claude Haiku 5.5"], "[Q10] that node is the model name");

  // No effort UI at all in the list: no strip above the rows, no per-row slider, no words.
  eq(ctx.react.findAll("quick-head").length, 0, "[Q10] no slider above the rows");
  eq(ctx.react.findAll("quick-words").length, 0, "[Q10] no effort words");
  eq(ctx.react.findAll("quick-track").length, 0, "[Q10] no track anywhere in the list");
  eq(ctx.react.findAll("quick-track").length + ctx.react.findAll("quick-bar").length, 0, "[Q10] no bar wrapper either");
  eq(ctx.react.findAll("quick-effort").length, 0, "[Q10] no row shows an effort word");
  ok(I.CSS.indexOf("mqs-list__head") < 0 && I.CSS.indexOf("mqs-list__word") < 0, "[Q10] the strip styles are gone from the bundle");

  // Moving inside the list only moves the highlight, and writes nothing.
  await g.move(0, ROW);
  eq(rows(ctx).map((r) => r.getAttribute("data-active")), ["0", "0", "1"], "[Q10] vertical drag moves the highlight");
  eq(ctx.host.selects.length, 0, "[Q10] nothing written while dragging");
  await g.move(-STEP3, ROW);
  eq(rows(ctx).map((r) => r.getAttribute("data-active")), ["0", "0", "1"], "[Q10] horizontal drag changes nothing");
  eq(ctx.host.selects.length, 0, "[Q10] still nothing written");
  await g.cancel(0, ROW);
});

await run("[Q10b]", async () => {
  // The top padding is not a row: releasing there cancels like anywhere else outside the rows.
  const ctx = await setup({ list: [item(OPUS), item(FLASH), item(HAIKU)] });
  const before = JSON.stringify(current(ctx));
  const layout = I.quickListLayout(ORIGIN.x, ORIGIN.y, 1, 3, VIEWPORT);
  const overPad = layout.top + I.QUICK_LIST_PAD_PX / 2 - ORIGIN.y;
  const g = gesture(ctx);
  g.down();
  await g.move(0, SLOP + 1);
  await g.up(0, overPad);                                // release inside the top padding
  eq(JSON.stringify(current(ctx)), before, "[Q10b] releasing outside the rows changes nothing");
  eq(listShown(ctx), 0, "[Q10b] the list still closes");
  eq(ctx.host.selects.length, 0, "[Q10b] nothing is selected");
});

await run("[Q10c]", async () => {
  const layout = I.quickListLayout(ORIGIN.x, ORIGIN.y, 1, 3, VIEWPORT);
  eq(layout.height, 2 * I.QUICK_LIST_PAD_PX + 3 * ROW, "[Q10c] the list is exactly padding + three rows");
  eq(I.quickRowAt(ORIGIN.x, layout.top + I.QUICK_LIST_PAD_PX + 2, layout, 3), 0, "[Q10c] the first row starts right below the padding");
  eq(I.quickRowAt(ORIGIN.x, layout.top + I.QUICK_LIST_PAD_PX + ROW + 1, layout, 3), 1, "[Q10c] the next row follows at one row height");
  eq(I.quickRowAt(ORIGIN.x, layout.top + 1, layout, 3), -1, "[Q10c] the padding itself is not a row");
  // The row under the press point is still the current model ("current row stays put").
  eq(I.quickRowAt(ORIGIN.x, ORIGIN.y, layout, 3), 1, "[Q10c] the current row sits under the press point");
});

section("Q11. Every string follows the DSH language setting");
await run("[Q11]", async () => {
  const locale = createFakeLocale("zh");
  const ctx = await setup({ list: [item(FLASH)], locale });
  eq(locale.registrations.length, 1, "[Q11] apply registers one dictionary set");
  eq(locale.registrations[0].ns, I.QUICK_NS, "[Q11] under the plugin's own namespace");
  eq(Object.keys(locale.registrations[0].dicts), ["zh", "en"], "[Q11] with both shipped languages");
  eq(ctx.host.registered[0].opts.locale, I.QUICK_NS, "[Q11] the slot entry declares the namespace (so the seat injects t)");
  eq(ctx.host.registered[0].opts.label(), "推理等级", "[Q11] the slot label follows the language too");

  // The gear lives in the official popover; open it, then click the gear.
  let panel = await openSettingsModal(ctx);
  const gear = gearOf(ctx);
  eq(gear.getAttribute("aria-label"), "快速选择与动画设置", "[Q11] gear aria-label in Chinese");
  eq(gear.getAttribute("title"), "快速选择与动画设置", "[Q11] gear title in Chinese");
  eq(panel.getAttribute("data-pane"), "root", "[Q11] the gear opens the root pane");
  eq(ctx.react.find("settings-title").textContent, "快速选择模型", "[Q11] modal title in Chinese");
  eq(ctx.react.find("settings-close").getAttribute("aria-label"), "关闭", "[Q11] close button label in Chinese");
  eq(ctx.react.find("settings-close").getAttribute("title"), "关闭", "[Q11] close button title in Chinese");
  ok(panel.textContent.indexOf("快速选择模型") >= 0, "[Q11] title in Chinese");
  ok(panel.textContent.indexOf("在模型按钮上竖向拖动即可在这些模型间切换。") >= 0, "[Q11] hint in Chinese");
  ok(panel.textContent.indexOf("已选（拖动排序）") >= 0, "[Q11] chosen section in Chinese");
  ok(panel.textContent.indexOf("全部模型") >= 0, "[Q11] catalog section in Chinese");
  ok(panel.textContent.indexOf("动画设置") >= 0, "[Q11] animation submenu row in Chinese");
  ok(panel.textContent.indexOf("推理") < 0 && panel.textContent.indexOf("左右") < 0, "[Q11] the hint no longer mentions effort");
  eq(panel.getAttribute("aria-label"), "快速选择模型设置", "[Q11] dialog aria-label in Chinese");
  eq(ctx.react.find("quick-chip").getAttribute("title"), "拖动排序", "[Q11] chip title in Chinese");
  eq(ctx.react.find("quick-chip-remove").getAttribute("aria-label"), "移除 deepseek-v4.1-flash", "[Q11] remove label in Chinese, name filled in");

  // The animation pane is the submenu of this same menu.
  ctx.react.find("quick-anim-entry").fire("onClick", {});
  await settle();
  panel = ctx.react.find("settings-card");
  eq(panel.getAttribute("data-pane"), "anim", "[Q11] the submenu entry opens the animation pane");
  for (const text of ["返回", "动画设置", "动画效果", "快速动画", "简洁动画", "完整动画", "已到达档位的刻度点", "亮白显示", "与未到达同色", "隐藏", "恢复默认"]) {
    ok(panel.textContent.indexOf(text) >= 0, "[Q11] animation pane label in Chinese: " + text);
  }
  eq(panel.querySelector('[data-ces-part="anim-field"][data-key="motion"]').getAttribute("aria-label"), "动画效果",
    "[Q11] the motion field label is Chinese");
  eq(panel.querySelector('[data-ces-part="anim-field"][data-key="reachedTicks"]').getAttribute("aria-label"), "已到达档位的刻度点",
    "[Q11] the reachedTicks field label is Chinese");
  ctx.react.find("anim-back").fire("onClick", {});
  await settle();
  eq(ctx.react.find("settings-card").getAttribute("data-pane"), "root", "[Q11] the back row returns to the quick-model pane");
  await closeSettingsModal(ctx);

  // Switch the language: the seat's t reads the active language on every call, so the next
  // render (here: closing and reopening the modal) shows English.
  locale.setLocale("en");
  panel = await openSettingsModal(ctx);
  eq(gearOf(ctx).getAttribute("aria-label"), "Quick selection and animation settings", "[Q11] gear aria-label follows the new language");
  eq(gearOf(ctx).getAttribute("title"), "Quick selection and animation settings", "[Q11] gear title follows too");
  eq(ctx.react.find("settings-title").textContent, "Quick model selection", "[Q11] modal title follows the new language");
  eq(ctx.react.find("settings-close").getAttribute("aria-label"), "Close", "[Q11] close button label follows too");
  ok(panel.textContent.indexOf("Quick model selection") >= 0, "[Q11] title follows the new language");
  ok(panel.textContent.indexOf("Drag the model button vertically to switch between these models.") >= 0, "[Q11] hint follows too");
  ok(panel.textContent.indexOf("Selected (drag to reorder)") >= 0, "[Q11] chosen section follows too");
  ok(panel.textContent.indexOf("All models") >= 0, "[Q11] catalog section follows too");
  ok(panel.textContent.indexOf("Animation settings") >= 0, "[Q11] animation submenu row follows too");
  ok(!/[\u4e00-\u9fff]/.test(allStrings(panel)), "[Q11] no Chinese left anywhere in the English root pane (text + attributes)");
  eq(panel.getAttribute("aria-label"), "Quick model selection settings", "[Q11] dialog aria-label follows too");
  eq(ctx.react.find("quick-chip-remove").getAttribute("aria-label"), "Remove deepseek-v4.1-flash", "[Q11] remove label follows too");

  ctx.react.find("quick-anim-entry").fire("onClick", {});
  await settle();
  panel = ctx.react.find("settings-card");
  for (const text of ["Back", "Animation settings", "Animation mode", "Fast animation", "Concise animation", "Full animation", "Reached level ticks", "Bright white", "Same as unreached", "Hidden", "Reset to defaults"]) {
    ok(panel.textContent.indexOf(text) >= 0, "[Q11] animation pane label in English: " + text);
  }
  ok(!/[\u4e00-\u9fff]/.test(allStrings(panel)), "[Q11] no Chinese left anywhere in the English animation pane");
  ctx.react.find("anim-back").fire("onClick", {});
  await settle();
  await closeSettingsModal(ctx);

  const g = gesture(ctx);
  g.down();
  await g.move(0, SLOP + 1);
  eq(ctx.react.find("quick-list").getAttribute("aria-label"), "Quick model selection", "[Q11] the list label follows too");
  await g.cancel(0, SLOP + 1);
  teardown();

  // The hint is gone from the source as well: the old horizontal-drag sentence must not come back.
  ok(readFileSync(BUNDLE, "utf8").indexOf("左右拖动调整推理等级") < 0, "[Q11] the old horizontal-drag hint is gone");

  // A model in the stored list that the catalog no longer offers is labelled in the same language.
  const zhAgain = createFakeLocale("zh");
  const gone = await setup({ list: [{ provider: P, model: "ghost" }], locale: zhAgain });
  const gonePanel = await openSettingsModal(gone);
  ok(gonePanel.textContent.indexOf("ghost（当前不可用）") >= 0, "[Q11] unavailable suffix in Chinese");
  teardown();

  // No locale service at all (bare composition / offline tests): same dictionary, English fallback.
  const bare = await setup({ list: [item(FLASH)] });
  const barePanel = await openSettingsModal(bare);
  ok(barePanel.textContent.indexOf("Quick model selection") >= 0, "[Q11] without the service the copy falls back to English");
  ok(!/[\u4e00-\u9fff]/.test(allStrings(barePanel)), "[Q11] and never leaks hard-coded Chinese");
  eq(bare.react.find("settings-title").textContent, "Quick model selection", "[Q11] fallback modal title is English");
  eq(bare.react.find("settings-close").getAttribute("aria-label"), "Close", "[Q11] fallback close label is English");
  eq(gearOf(bare).getAttribute("aria-label"), "Quick selection and animation settings", "[Q11] fallback gear label is English");
  eq(bare.react.find("quick-chip-remove").getAttribute("aria-label"), "Remove deepseek-v4.1-flash",
    "[Q11] fallback fills {name} in the remove label");
  bare.react.find("quick-anim-entry").fire("onClick", {});
  await settle();
  const bareAnim = bare.react.find("settings-card");
  ok(bareAnim.textContent.indexOf("Animation settings") >= 0, "[Q11] fallback animation pane is English");
  ok(!/[\u4e00-\u9fff]/.test(allStrings(bareAnim)), "[Q11] fallback animation pane has no Chinese");
});

console.log("\n" + (failed === 0 ? "All passed ✅" : "Failures ❌") + " (" + passed + " passed, " + failed + " failed)");
process.exit(failed === 0 ? 0 : 1);
