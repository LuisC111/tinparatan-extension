import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { parseBackup, buildBackup } from "../lib/backup.js";
import { sanitizeCss } from "../lib/css-sanitize.js";
import { isLight, safeColor } from "../lib/color.js";
import {
  CLOCK_STYLE_DEFAULTS,
  DATE_STYLE_DEFAULTS,
  TEXT_EFFECTS,
  formatClock,
  formatDate,
} from "../lib/clockstyle.js";
import { normalizeSettings } from "../lib/normalize.js";
import {
  GREETING_GRADIENTS,
  GREETING_PHASES,
  greetingKey,
  greetingPhase,
  greetingPrefix,
  msToNextMinute,
} from "../lib/greeting.js";
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
  assert.equal(manifest.version, "1.3.0");
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
  assert.equal(fresh.version, 3);
  assert.deepEqual(fresh.search.suggest, { engine: "google", shortcuts: true, history: false });
  assert.equal(fresh.profile.name, "");
  assert.equal(fresh.profile.effect, "neon");

  const v1 = normalizeSettings({ version: 1, search: { engine: "brave" }, widgets: { greeting: { enabled: true, name: "Lucho" } } });
  assert.equal(v1.search.engine, "brave");
  assert.equal(v1.search.suggest.engine, "google");
  assert.equal(v1.profile.name, "Lucho", "greeting name is adopted");
  assert.equal(v1.widgets.greeting, undefined, "the old top greeting widget is gone");

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

test("greeting phases cover the day with exact boundaries", () => {
  // Contiguous, no gaps, whole day.
  assert.equal(GREETING_PHASES[0].from, 0);
  assert.equal(GREETING_PHASES.at(-1).to, 1440);
  for (let i = 1; i < GREETING_PHASES.length; i += 1) assert.equal(GREETING_PHASES[i].from, GREETING_PHASES[i - 1].to);
  const at = (h, m = 0) => greetingPhase(new Date(2026, 9, 28, h, m, 0));
  const cases = [
    [0, 0, "madrugada"], [4, 59, "madrugada"],
    [5, 0, "amanecer"], [6, 59, "amanecer"],
    [7, 0, "manana"], [11, 59, "manana"],
    [12, 0, "mediodia"], [13, 59, "mediodia"],
    [14, 0, "tarde"], [17, 59, "tarde"],
    [18, 0, "atardecer"], [19, 29, "atardecer"],
    [19, 30, "noche"], [23, 59, "noche"],
  ];
  for (const [h, m, phase] of cases) assert.equal(at(h, m), phase, `${h}:${m}`);
  assert.equal(greetingPhase(1440 + 60), "madrugada", "minutes wrap around midnight");
  assert.equal(greetingPhase(-1), "noche");
  for (const phase of GREETING_PHASES) {
    assert.equal(GREETING_GRADIENTS[phase.id].length, 3);
    assert.ok(GREETING_GRADIENTS[phase.id].every((c) => /^#[0-9a-f]{6}$/.test(c)));
  }
  assert.equal(greetingKey("nope"), "greeting.noche");
  assert.equal(msToNextMinute(new Date(2026, 9, 28, 10, 0, 59, 900)), 150);
});

test("greeting phrases, prefix and css stay in sync", async () => {
  const { es: dict } = await import("../lib/locales/es.js");
  const phrases = Object.fromEntries(GREETING_PHASES.map((p) => [p.id, greetingKey(p.id).split(".").reduce((n, k) => n?.[k], dict)]));
  assert.deepEqual(phrases, {
    madrugada: "Buena madrugada",
    amanecer: "Buenos días",
    manana: "Buenos días",
    mediodia: "Buen mediodía",
    tarde: "Buenas tardes",
    atardecer: "Buenas tardes",
    noche: "Buenas noches",
  });
  assert.equal(greetingPrefix("Buenas noches", true), "Buenas noches,");
  assert.equal(greetingPrefix("Buenas noches", false), "Buenas noches");
  assert.equal(greetingPrefix("¡Qué más!", true), "¡Qué más!");
  assert.equal(greetingPrefix("  ", true), "");
  const css = fs.readFileSync(new URL("../assets/profile.css", import.meta.url), "utf8");
  for (const [id, colors] of Object.entries(GREETING_GRADIENTS)) {
    const rule = css.match(new RegExp(`data-phase="${id}"\\] \\{([^}]*)\\}`));
    assert.ok(rule, `css for ${id}`);
    for (const c of colors) assert.ok(rule[1].includes(c), `${id} uses ${c}`);
  }
});

test("v3 migration folds the top greeting widget into the profile", () => {
  // v2 with the old widget on and a profile: widget removed, profile untouched.
  const v2 = normalizeSettings({
    version: 2,
    widgets: { clock: { enabled: true }, greeting: { enabled: true, position: "top-center", name: "Lucho" } },
    profile: { name: "Lucho", effect: "neon" },
  });
  assert.equal(v2.version, 3);
  assert.equal(v2.widgets.greeting, undefined);
  assert.equal(v2.widgets.clock.enabled, true, "clock is kept");
  assert.equal(v2.profile.name, "Lucho");
  assert.equal(v2.profile.greet, true);
  assert.equal(v2.profile.greetText, "");
  assert.equal(v2.profile.greetGradient, true);
  assert.equal(v2.profile.placement, "between");
  // Bad values fall back; good ones survive a round trip.
  const odd = normalizeSettings({ profile: { placement: "sideways", greetGradient: "yes", greetText: 42 } });
  assert.equal(odd.profile.placement, "between");
  assert.equal(odd.profile.greetGradient, true);
  assert.equal(odd.profile.greetText, "");
  const kept = normalizeSettings({ profile: { placement: "below-wordmark", greetGradient: false, greetText: "Qué más" } });
  assert.deepEqual(
    [kept.profile.placement, kept.profile.greetGradient, kept.profile.greetText],
    ["below-wordmark", false, "Qué más"],
  );
  assert.equal(normalizeSettings({ profile: { greetText: "x".repeat(80) } }).profile.greetText.length, 40);
  assert.deepEqual(normalizeSettings(kept), kept, "normalize is idempotent");
});

test("search text alignment defaults to left and rejects junk", () => {
  assert.equal(normalizeSettings(null).search.align, "left");
  assert.equal(normalizeSettings({ search: { align: "center" } }).search.align, "center");
  assert.equal(normalizeSettings({ search: { align: "right" } }).search.align, "right");
  assert.equal(normalizeSettings({ search: { align: "justify" } }).search.align, "left");
  const css = fs.readFileSync(new URL("../newtab/newtab.css", import.meta.url), "utf8");
  assert.match(css, /data-search-align="center"\] \.search-form input \{ text-align: center/);
  assert.match(css, /-webkit-search-cancel-button \{ cursor: pointer; \}/);
});

test("clock formats 24h, 12h and the a. m./p. m. styles", () => {
  const evening = new Date(2026, 9, 28, 21, 5, 9);
  const morning = new Date(2026, 9, 28, 0, 7, 3);
  assert.deepEqual(formatClock(evening, { format24: true, seconds: false }), { time: "21:05", period: "" });
  assert.deepEqual(formatClock(evening, { format24: true, seconds: true }), { time: "21:05:09", period: "" });
  assert.deepEqual(formatClock(morning, { format24: true }), { time: "00:07", period: "" });
  assert.deepEqual(formatClock(evening, { format24: false, ampm: "full" }), { time: "9:05", period: "p.\u00a0m." });
  assert.deepEqual(formatClock(morning, { format24: false, ampm: "full" }), { time: "12:07", period: "a.\u00a0m." });
  assert.deepEqual(formatClock(new Date(2026, 9, 28, 12, 0), { format24: false, ampm: "short" }), { time: "12:00", period: "pm" });
  assert.deepEqual(formatClock(evening, { format24: false, ampm: "hidden", seconds: true }), { time: "9:05:09", period: "" });
  assert.equal(formatClock(evening, { format24: false, ampm: "full" }, "en").period, "PM");
});

test("date formats and capitalization", () => {
  const day = new Date(2026, 9, 28, 10, 0);
  // Default reproduces the old CSS text-transform: capitalize.
  assert.equal(formatDate(day), "Miércoles, 28 De Octubre");
  assert.equal(formatDate(day, "plain", "lower"), "miércoles 28 de octubre");
  assert.equal(formatDate(day, "numeric", "upper"), "28/10/2026");
  assert.equal(formatDate(day, "short", "title"), "Mié 28 Oct");
  assert.equal(formatDate(day, "long", "sentence"), "Miércoles, 28 de octubre");
  assert.equal(formatDate(day, "long", "upper"), "MIÉRCOLES, 28 DE OCTUBRE");
  assert.equal(formatDate(day, "full", "lower"), "miércoles, 28 de octubre de 2026");
  assert.equal(formatDate(day, "bogus", "bogus"), "Miércoles, 28 De Octubre");
  assert.equal(formatDate(day, "numeric", "title", "en"), "10/28/2026");
  assert.equal(formatDate(day, "short", "title", "en"), "Wed Oct 28");
});

test("clock and date styles default to the original look and reject junk", () => {
  const fresh = normalizeSettings(null);
  assert.deepEqual(fresh.widgets.clock.style, CLOCK_STYLE_DEFAULTS);
  assert.deepEqual(fresh.widgets.date.style, DATE_STYLE_DEFAULTS);
  assert.equal(fresh.widgets.clock.ampm, "full");
  assert.equal(fresh.widgets.date.format, "long");
  assert.equal(fresh.widgets.date.case, "title");
  // v2 data without any style keeps the old clock settings and gets the defaults.
  const v2 = normalizeSettings({ version: 2, widgets: { clock: { enabled: true, format24: false, seconds: true } } });
  assert.equal(v2.widgets.clock.format24, false);
  assert.equal(v2.widgets.clock.seconds, true);
  assert.deepEqual(v2.widgets.clock.style, CLOCK_STYLE_DEFAULTS);
  const junk = normalizeSettings({
    widgets: {
      clock: { ampm: "x", style: { fontId: "comic", size: 999, weight: 450, effect: "fire", colors: ["red", "#ABCDEF"], letterSpacing: 3, opacity: 5 } },
      date: { format: "x", case: "x", style: { size: "a", effect: "time", fontId: "pacifico" } },
    },
  });
  assert.deepEqual(junk.widgets.clock.style, {
    fontId: "default", size: 160, weight: 500, effect: "plain", colors: ["#f5f7fb", "#abcdef"], letterSpacing: 0.4, opacity: 20,
  });
  assert.equal(junk.widgets.clock.ampm, "full");
  assert.equal(junk.widgets.date.format, "long");
  assert.equal(junk.widgets.date.case, "title");
  assert.equal(junk.widgets.date.style.size, 13);
  assert.equal(junk.widgets.date.style.effect, "time");
  assert.equal(junk.widgets.date.style.fontId, "pacifico");
  assert.ok(TEXT_EFFECTS.includes("time") && TEXT_EFFECTS.includes("neon") && TEXT_EFFECTS[0] === "plain");
  // Round-trip is stable.
  assert.deepEqual(normalizeSettings(structuredClone(junk)).widgets, junk.widgets);
});
