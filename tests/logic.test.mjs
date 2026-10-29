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
import {
  GRADIENT_SWATCHES,
  PROFILE_EFFECTS,
  PROFILE_FONTS,
  normalizeProfile,
  randomizeProfile,
} from "../lib/profile.js";
import {
  SUGGEST_HOSTS,
  acceptText,
  buildSuggestUrl,
  decodeBody,
  highlightParts,
  inlineCompletion,
  matchHistory,
  matchShortcuts,
  mergeSuggestions,
  parseSuggestions,
} from "../lib/suggest.js";

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
  assert.equal(manifest.version, "1.2.0");
  assert.deepEqual(manifest.host_permissions, SUGGEST_HOSTS);
  assert.deepEqual(manifest.optional_permissions, ["history"]);
  assert.equal(manifest.permissions.includes("history"), false, "history must stay optional");
  // Every @font-face in the shared stylesheets points at a bundled file with its license next to it.
  for (const sheet of ["assets/tokens.css", "assets/profile.css"]) {
    const css = fs.readFileSync(new URL(`../${sheet}`, import.meta.url), "utf8");
    const urls = [...css.matchAll(/url\("(fonts\/[^"]+)"\)/g)].map((m) => m[1]);
    assert.ok(urls.length > 0, sheet);
    for (const font of urls) assert.equal(fs.existsSync(new URL(`../assets/${font}`, import.meta.url)), true, font);
  }
  const profileCss = fs.readFileSync(new URL("../assets/profile.css", import.meta.url), "utf8");
  for (const font of PROFILE_FONTS) {
    const family = font.family.match(/^"([^"]+)"/)[1];
    if (family.startsWith("TP ")) assert.ok(profileCss.includes(`font-family: "${family}"`), family);
  }
  for (const effect of PROFILE_EFFECTS) assert.ok(profileCss.includes(`[data-effect="${effect.id}"]`), effect.id);
  // Every relative src/href in the extension pages resolves.
  for (const page of ["newtab/newtab.html", "options/options.html", "popup/popup.html"]) {
    const html = fs.readFileSync(new URL(`../${page}`, import.meta.url), "utf8");
    for (const [, ref] of html.matchAll(/(?:src|href)="(\.{0,2}\/?[^":#?]+\.(?:js|css|png|svg|ico))"/g)) {
      assert.equal(fs.existsSync(new URL(ref, new URL(`../${page}`, import.meta.url))), true, `${page} -> ${ref}`);
    }
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

test("suggest urls per engine", () => {
  const google = new URL(buildSuggestUrl("google", "gatos & perros", "es-CO"));
  assert.equal(google.host, "suggestqueries.google.com");
  assert.equal(google.searchParams.get("client"), "chrome");
  assert.equal(google.searchParams.get("hl"), "es-CO");
  assert.equal(google.searchParams.get("oe"), "utf-8");
  assert.equal(google.searchParams.get("q"), "gatos & perros");
  const ddg = new URL(buildSuggestUrl("duckduckgo", "café", "es-CO"));
  assert.equal(ddg.pathname, "/ac/");
  assert.equal(ddg.searchParams.get("type"), "list");
  assert.equal(ddg.searchParams.get("kl"), "co-es");
  assert.equal(ddg.searchParams.get("q"), "café");
  const brave = new URL(buildSuggestUrl("brave", "helium", "en"));
  assert.equal(`${brave.origin}${brave.pathname}`, "https://search.brave.com/api/suggest");
  assert.equal(buildSuggestUrl("off", "x", "es"), "");
  assert.equal(buildSuggestUrl("google", "   ", "es"), "");
  assert.equal(buildSuggestUrl("evil", "x", "es"), "");
  assert.ok(buildSuggestUrl("google", "a".repeat(5000), "es").length < 400);
  // Every engine URL is covered by a manifest host permission.
  for (const engine of ["google", "duckduckgo", "brave"]) {
    const url = buildSuggestUrl(engine, "x", "es-CO");
    assert.ok(SUGGEST_HOSTS.some((host) => url.startsWith(host.replace(/\*$/, ""))), engine);
  }
});

test("suggestion payloads parse per engine", () => {
  const google = [
    "git",
    ["github", "GitHub ", "https://github.com/", "gitlab", ""],
    ["", "", "GitHub", "", ""],
    [],
    { "google:suggesttype": ["QUERY", "QUERY", "NAVIGATION", "QUERY", "QUERY"] },
  ];
  assert.deepEqual(parseSuggestions("google", JSON.stringify(google)), [
    { kind: "search", text: "github" },
    { kind: "url", text: "https://github.com/" },
    { kind: "search", text: "gitlab" },
  ]);
  assert.deepEqual(parseSuggestions("duckduckgo", '["gat",["gatos","gato negro"]]'), [
    { kind: "search", text: "gatos" },
    { kind: "search", text: "gato negro" },
  ]);
  assert.deepEqual(parseSuggestions("duckduckgo", [{ phrase: "gatos" }, { phrase: "gatitos" }]), [
    { kind: "search", text: "gatos" },
    { kind: "search", text: "gatitos" },
  ]);
  assert.deepEqual(parseSuggestions("brave", ["hel", ["helium browser", "hello"]], 1), [{ kind: "search", text: "helium browser" }]);
  // Brave/DDG never mark navigation even if a 5th element shows up.
  assert.equal(parseSuggestions("brave", ["x", ["x.com"], [], [], { "google:suggesttype": ["NAVIGATION"] }])[0].kind, "search");
  assert.deepEqual(parseSuggestions("google", "<html>nope"), []);
  assert.deepEqual(parseSuggestions("google", null), []);
  assert.deepEqual(parseSuggestions("google", { a: 1 }), []);
  assert.deepEqual(parseSuggestions("duckduckgo", ["q", [1, null, "ok"]]), [{ kind: "search", text: "ok" }]);
});

test("suggest bodies decode by charset", () => {
  const latin1 = Uint8Array.from([0x5b, 0x22, 0x63, 0x61, 0x66, 0xe9, 0x22, 0x5d]); // ["café"] in ISO-8859-1
  assert.equal(decodeBody(latin1, "text/javascript; charset=ISO-8859-1"), '["café"]');
  const utf8 = new TextEncoder().encode('["niño"]');
  assert.equal(decodeBody(utf8, "application/json"), '["niño"]');
  assert.equal(decodeBody(utf8, "text/plain; charset=bogus-xyz"), '["niño"]');
});

test("suggestions merge shortcuts, history and remote without duplicates", () => {
  const items = [
    { id: "a", title: "GitHub", url: "https://github.com/" },
    { id: "b", title: "YouTube", url: "https://www.youtube.com/" },
    { id: "c", title: "Correo", url: "https://mail.google.com/" },
  ];
  const shortcuts = matchShortcuts(items, "git");
  assert.equal(shortcuts.length, 1);
  assert.equal(shortcuts[0].kind, "shortcut");
  assert.equal(shortcuts[0].sub, "github.com");
  assert.equal(matchShortcuts(items, "you")[0].text, "YouTube");
  assert.equal(matchShortcuts(items, "google")[0].text, "Correo");
  assert.deepEqual(matchShortcuts(items, "  "), []);
  assert.deepEqual(matchShortcuts([{ title: "x", url: "javascript:alert(1)" }], "x"), []);

  const history = matchHistory(
    [
      { url: "https://github.com", title: "GitHub", visitCount: 50 },
      { url: "https://gitlab.com/explore", title: "GitLab", visitCount: 2, typedCount: 1 },
      { url: "https://git-scm.com/docs", title: "Git docs", visitCount: 9 },
      { url: "chrome://settings", title: "git settings", visitCount: 99 },
    ],
    "git",
  );
  assert.deepEqual(history.map((h) => h.sub), ["github.com", "git-scm.com", "gitlab.com"]);
  assert.ok(history.every((h) => h.kind === "history"));

  const remote = parseSuggestions("google", [
    "git",
    ["git", "github", "GITHUB", "github.com", "git commit"],
    [],
    [],
    { "google:suggesttype": ["QUERY", "QUERY", "QUERY", "NAVIGATION", "QUERY"] },
  ]);
  const merged = mergeSuggestions({ query: "git", shortcuts, history, remote, limit: 8 });
  // github.com appears once (the shortcut); history duplicate and nav duplicate are dropped.
  assert.equal(merged.filter((e) => e.url && e.url.includes("github.com")).length, 1);
  assert.equal(merged[0].kind, "shortcut");
  assert.deepEqual(
    merged.map((e) => e.kind),
    ["shortcut", "history", "history", "search", "search"],
  );
  assert.deepEqual(
    merged.filter((e) => e.kind === "search").map((e) => e.text),
    ["github", "git commit"],
  );
  assert.equal(mergeSuggestions({ query: "a", remote: parseSuggestions("brave", ["a", "abcdefghij".split("")]), limit: 4 }).length, 4);
  const nav = mergeSuggestions({ query: "wiki", remote: [{ kind: "url", text: "es.wikipedia.org" }] });
  assert.deepEqual(nav, [{ kind: "url", text: "es.wikipedia.org", url: "https://es.wikipedia.org" }]);
});

test("highlight, inline completion and tab acceptance", () => {
  assert.deepEqual(highlightParts("Gatos negros", "NEG"), [
    { text: "Gatos ", match: false },
    { text: "neg", match: true },
    { text: "ros", match: false },
  ]);
  assert.deepEqual(highlightParts("abc", "zz"), [{ text: "abc", match: false }]);
  assert.deepEqual(highlightParts("abc", ""), [{ text: "abc", match: false }]);
  const list = [
    { kind: "shortcut", text: "GitHub", url: "https://github.com/", sub: "github.com" },
    { kind: "search", text: "github copilot" },
  ];
  assert.equal(inlineCompletion("Git", list), "Github.com");
  assert.equal(inlineCompletion("github c", list), "github copilot");
  assert.equal(inlineCompletion("zz", list), "");
  assert.equal(inlineCompletion("   ", list), "");
  assert.equal(inlineCompletion("github copilot", list), "");
  assert.equal(acceptText(list[0]), "https://github.com/");
  assert.equal(acceptText(list[1]), "github copilot");
  assert.equal(acceptText(null), "");
});

test("display name profile normalizes and randomizes safely", () => {
  assert.equal(PROFILE_FONTS.length, 12);
  assert.deepEqual(
    PROFILE_EFFECTS.map((e) => e.id),
    ["solid", "gradient", "neon", "cartoon", "pop", "jelly", "prism"],
  );
  const clean = normalizeProfile({
    name: "Lu\u0000cho".padEnd(60, "!"),
    fontId: "comic-sans",
    effect: "<script>",
    colors: ["#ABCDEF", "red"],
    size: 999,
    show: "yes",
  });
  assert.equal(clean.name.length, 32);
  assert.equal(clean.name.startsWith("Lucho"), true);
  assert.equal(clean.fontId, "montserrat");
  assert.equal(clean.effect, "neon");
  assert.deepEqual(clean.colors, ["#abcdef", "#7c5cff"]);
  assert.equal(clean.size, 56);
  assert.equal(clean.show, true);
  assert.equal(normalizeProfile(null, "Lucho").name, "Lucho");

  // Deterministic PRNG so the test is reproducible.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const fonts = new Set(PROFILE_FONTS.map((f) => f.id));
  const effects = new Set(PROFILE_EFFECTS.map((e) => e.id));
  let current = normalizeProfile({ name: "Lucho", show: false });
  const seen = new Set();
  for (let i = 0; i < 300; i += 1) {
    const next = randomizeProfile(current, rand);
    assert.equal(next.name, "Lucho");
    assert.equal(next.show, false);
    assert.ok(fonts.has(next.fontId));
    assert.ok(effects.has(next.effect));
    assert.ok(next.colors.every((c) => /^#[0-9a-f]{6}$/.test(c)), next.colors.join());
    assert.notDeepEqual([next.fontId, next.effect], [current.fontId, current.effect]);
    assert.deepEqual(normalizeProfile(next), next);
    seen.add(next.effect);
    current = next;
  }
  assert.equal(seen.size, PROFILE_EFFECTS.length);
  // Edge values of rand() stay in range.
  for (const edge of [0, 0.999999]) {
    const out = randomizeProfile(current, () => edge);
    assert.ok(fonts.has(out.fontId) && effects.has(out.effect));
  }
  assert.ok(GRADIENT_SWATCHES.every((pair) => pair.every((c) => /^#[0-9a-f]{6}$/.test(c))));
});

test("settings defaults and v1 migration for suggestions and profile", () => {
  const fresh = normalizeSettings(null);
  assert.equal(fresh.version, 2);
  assert.deepEqual(fresh.search.suggest, { engine: "google", shortcuts: true, history: false });
  assert.equal(fresh.profile.name, "");
  assert.equal(fresh.profile.effect, "neon");

  const v1 = normalizeSettings({ version: 1, search: { engine: "brave" }, widgets: { greeting: { enabled: true, name: "Lucho" } } });
  assert.equal(v1.search.engine, "brave");
  assert.equal(v1.search.suggest.engine, "google");
  assert.equal(v1.profile.name, "Lucho", "greeting name is adopted");
  assert.equal(v1.widgets.greeting.name, "Lucho");

  const v2 = normalizeSettings({
    search: { suggest: { engine: "nope", shortcuts: false, history: "x" } },
    profile: { name: "", fontId: "pacifico" },
    widgets: { greeting: { name: "Lucho" } },
  });
  assert.equal(v2.search.suggest.engine, "google");
  assert.equal(v2.search.suggest.shortcuts, false);
  assert.equal(v2.search.suggest.history, false);
  assert.equal(v2.profile.name, "", "an explicitly empty v2 name is respected");
  assert.equal(v2.profile.fontId, "pacifico");
  assert.equal(normalizeSettings({ search: { suggest: { engine: "off" } } }).search.suggest.engine, "off");
  // Presets restyle the page but never touch the personal profile.
  const styled = applyVisualPreset(normalizeSettings({ profile: { name: "Lucho", effect: "prism" } }), PRESETS[1].id);
  assert.equal(styled.profile.name, "Lucho");
  assert.equal(styled.profile.effect, "prism");
});
