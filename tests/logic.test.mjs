import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { parseBackup, buildBackup } from "../lib/backup.js";
import { sanitizeCss } from "../lib/css-sanitize.js";
import { isLight, safeColor } from "../lib/color.js";
import { normalizeSettings } from "../lib/normalize.js";
import { planStartupTabs, tabsNeedingReload } from "../lib/pinned.js";
import { applyVisualPreset, PRESETS } from "../lib/presets.js";
import { resolveInput, safeHttpUrl } from "../lib/search.js";

test("manifest is a loadable MV3 extension", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.chrome_url_overrides.newtab, "newtab/newtab.html");
  assert.equal(manifest.background.type, "module");
  for (const file of [
    manifest.background.service_worker,
    manifest.action.default_popup,
    manifest.options_ui.page,
    manifest.chrome_url_overrides.newtab,
    "assets/logo.png",
    "assets/tinparatan.ico",
    "assets/icons/icon-16.png",
    "assets/icons/icon-32.png",
    "assets/icons/icon-48.png",
    "assets/icons/icon-128.png",
    "themes/tinparatan-theme/manifest.json",
  ]) {
    assert.equal(fs.existsSync(new URL(`../${file}`, import.meta.url)), true, file);
  }
  const theme = JSON.parse(fs.readFileSync(new URL("../themes/tinparatan-theme/manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(theme.theme.colors.frame, [7, 11, 20]);
  assert.equal(theme.theme.colors.ntp_link[0], 225);
});

test("search stays on http(s) and treats addresses as navigation", () => {
  const template = "https://duckduckgo.com/?q=%s";
  assert.equal(resolveInput("  gatos ", template), "https://duckduckgo.com/?q=gatos");
  assert.equal(resolveInput("https://example.com/a", template), "https://example.com/a");
  assert.equal(resolveInput("example.com/docs", template), "https://example.com/docs");
  assert.equal(resolveInput("localhost:8080/app", template), "http://localhost:8080/app");
  assert.equal(resolveInput("helium://extensions", template), "helium://extensions");
  assert.equal(resolveInput("javascript:alert(1)", template).startsWith("https://duckduckgo.com/"), true);
  assert.equal(safeHttpUrl("javascript:alert(1)"), "");
  assert.equal(safeColor("red; background:url(https://evil)", "#fff"), "#fff");
  assert.equal(isLight("#f4efe8"), true);
  assert.equal(isLight("#070b14"), false);
});

test("startup pinned tabs are created once and not duplicated", () => {
  const tabs = [
    { id: 1, pinned: false, url: "https://example.com/" },
    { id: 2, pinned: true, url: "https://already.test/path" },
  ];
  const plan = planStartupTabs(tabs, [
    "https://example.com",
    "https://example.com/",
    "https://already.test/path",
    "https://fresh.test",
    "javascript:alert(1)",
  ]);
  assert.deepEqual(plan.pin, [1]);
  assert.deepEqual(plan.create, ["https://fresh.test/"]);
  assert.deepEqual(
    tabsNeedingReload([
      { id: 3, pinned: true, discarded: true, status: "unloaded" },
      { id: 4, pinned: true, discarded: false, status: "complete" },
      { id: 5, pinned: false, discarded: true, status: "unloaded" },
    ]).map((tab) => tab.id),
    [3],
  );
});

test("presets keep personal data and sanitize css", () => {
  const settings = normalizeSettings({
    pinnedTabs: { startupUrls: ["https://keep.test"] },
    shortcuts: { enabled: true, items: [{ id: "a", title: "A", url: "https://keep.test" }] },
    customCss: "@import url(https://evil.test/x.css); body { color: red; background: url(https://evil.test/a.png); }",
  });
  assert.match(settings.customCss, /import removed/);
  assert.match(settings.customCss, /remote url removed/);
  assert.match(settings.customCss, /color:\s*red/);
  const next = applyVisualPreset(settings, PRESETS.find((preset) => preset.id === "aurora"));
  assert.equal(next.theme.presetId, "aurora");
  assert.equal(next.background.effect, "aurora");
  assert.deepEqual(next.pinnedTabs.startupUrls, ["https://keep.test"]);
  assert.equal(next.shortcuts.items[0].title, "A");
  assert.equal(PRESETS.length >= 6, true);
});

test("backup rejects foreign json", () => {
  assert.throws(() => parseBackup("{}"));
  const raw = buildBackup({ settings: { locale: "en" }, notes: "hola", todos: [], media: [] });
  const parsed = parseBackup(JSON.stringify(raw));
  assert.equal(parsed.notes, "hola");
  assert.equal(parsed.settings.locale, "en");
});

test("spanish and english catalogs share keys", async () => {
  const { es } = await import("../lib/locales/es.js");
  const { en } = await import("../lib/locales/en.js");
  const keys = (node, prefix = "") =>
    Object.entries(node).flatMap(([key, value]) =>
      value && typeof value === "object" ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
    );
  assert.deepEqual(keys(es).sort(), keys(en).sort());
});
