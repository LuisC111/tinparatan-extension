import { safeColor } from "./color.js";
import { sanitizeCss } from "./css-sanitize.js";
import { DEFAULT_SETTINGS, ORDER_IDS, POSITIONS } from "./defaults.js";
import { FONTS } from "./fonts.js";
import { ENGINES, isHttpUrl } from "./search.js";
import { clamp, deepMerge } from "./util.js";

const FONT_IDS = new Set(FONTS.map((font) => font.id));
const ENGINE_IDS = new Set(ENGINES.map((engine) => engine.id));
const POSITION_SET = new Set(POSITIONS);

function pick(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
}

function flag(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function cleanShortcut(item, index) {
  const source = item && typeof item === "object" ? item : {};
  const iconType = pick(source.iconType, new Set(["letter", "emoji", "image"]), "letter");
  return {
    id: typeof source.id === "string" && source.id.length <= 80 ? source.id : `sc-${index + 1}`,
    title: String(source.title || "").slice(0, 40),
    url: isHttpUrl(source.url) ? String(source.url).trim().slice(0, 500) : "",
    iconType,
    emoji: String(source.emoji || "").slice(0, 8),
    iconId: typeof source.iconId === "string" ? source.iconId.slice(0, 80) : "",
    color: safeColor(source.color, DEFAULT_SETTINGS.theme.accent),
  };
}

function cleanPreset(item) {
  if (!item || typeof item !== "object") return null;
  const id = typeof item.id === "string" ? item.id.slice(0, 80) : "";
  const name = typeof item.name === "string" ? item.name.trim().slice(0, 40) : "";
  if (!id || !name || !item.values || typeof item.values !== "object") return null;
  return { id, name, values: item.values };
}

export function mergeDefaults(partial) {
  const base = structuredClone(DEFAULT_SETTINGS);
  if (!partial || typeof partial !== "object" || Array.isArray(partial)) return base;
  return deepMerge(base, partial);
}

export function normalizeSettings(partial) {
  const s = mergeDefaults(partial);
  const d = DEFAULT_SETTINGS;
  s.version = 1;
  s.locale = s.locale === "en" ? "en" : "es";
  s.motion = pick(s.motion, new Set(["system", "on", "off"]), "system");

  s.theme.presetId = String(s.theme.presetId || "custom").slice(0, 80);
  s.theme.accent = safeColor(s.theme.accent, d.theme.accent);
  s.theme.background = safeColor(s.theme.background, d.theme.background);
  s.theme.surface = safeColor(s.theme.surface, d.theme.surface);
  s.theme.text = safeColor(s.theme.text, d.theme.text);
  s.theme.muted = safeColor(s.theme.muted, d.theme.muted);
  s.theme.line = safeColor(s.theme.line, d.theme.line);
  s.theme.prompt = safeColor(s.theme.prompt, d.theme.prompt);
  s.theme.wordmark = safeColor(s.theme.wordmark, d.theme.wordmark);
  s.theme.searchBg = safeColor(s.theme.searchBg, d.theme.searchBg);
  s.theme.searchText = safeColor(s.theme.searchText, d.theme.searchText);
  s.theme.placeholder = safeColor(s.theme.placeholder, d.theme.placeholder);
  s.theme.vignette = clamp(s.theme.vignette, 0, 0.85);

  s.logo.mode = pick(s.logo.mode, new Set(["default", "custom", "none"]), "default");
  s.logo.mediaId = "logo-custom";
  s.logo.size = clamp(s.logo.size, 64, 360);
  s.logo.glow = flag(s.logo.glow, true);
  s.logo.float = flag(s.logo.float, true);

  s.wordmark.text = String(s.wordmark.text ?? "").slice(0, 48);
  s.wordmark.showPrompt = flag(s.wordmark.showPrompt, true);
  s.wordmark.prompt = String(s.wordmark.prompt || ">").slice(0, 2);
  s.wordmark.showCursor = flag(s.wordmark.showCursor, true);
  s.wordmark.cursorStyle = pick(
    s.wordmark.cursorStyle,
    new Set(["underscore", "block", "bar", "none"]),
    "underscore",
  );
  s.wordmark.fontId = FONT_IDS.has(s.wordmark.fontId) ? s.wordmark.fontId : "jetbrains-mono";
  s.wordmark.fontSize = clamp(s.wordmark.fontSize, 20, 96);
  s.wordmark.letterSpacing = clamp(s.wordmark.letterSpacing, -4, 12);
  s.wordmark.fontWeight = clamp(Math.round(s.wordmark.fontWeight / 50) * 50, 400, 700);
  s.wordmark.typing = flag(s.wordmark.typing, true);
  s.wordmark.typingMs = clamp(s.wordmark.typingMs, 20, 280);

  s.layout.alignX = pick(s.layout.alignX, new Set(["left", "center", "right"]), "center");
  s.layout.alignY = pick(s.layout.alignY, new Set(["start", "center", "end"]), "center");
  s.layout.gap = clamp(s.layout.gap, 0, 80);
  s.layout.offsetY = clamp(s.layout.offsetY, -24, 24);
  const order = (Array.isArray(s.layout.order) ? s.layout.order : []).filter((id) => ORDER_IDS.includes(id));
  for (const id of ORDER_IDS) if (!order.includes(id)) order.push(id);
  s.layout.order = order;

  s.background.type = pick(
    s.background.type,
    new Set(["solid", "gradient", "image", "video", "effect"]),
    "solid",
  );
  s.background.color = safeColor(s.background.color, d.background.color);
  s.background.fit = s.background.fit === "contain" ? "contain" : "cover";
  s.background.effect = pick(
    s.background.effect,
    new Set(["stars", "particles", "aurora", "matrix", "embers"]),
    "stars",
  );
  s.background.intensity = clamp(s.background.intensity, 0.15, 1);
  s.background.blur = clamp(s.background.blur, 0, 32);
  s.background.dim = clamp(s.background.dim, 0, 0.8);
  s.background.brightness = clamp(s.background.brightness, 0.35, 1.5);
  s.background.imageId = "bg-image";
  s.background.videoId = "bg-video";
  s.background.gradient.animate = flag(s.background.gradient.animate, true);
  s.background.gradient.angle = clamp(s.background.gradient.angle, 0, 360);
  const colors = (s.background.gradient.colors || []).slice(0, 3).map((color, index) =>
    safeColor(color, d.background.gradient.colors[index]),
  );
  while (colors.length < 3) colors.push(d.background.gradient.colors[colors.length]);
  s.background.gradient.colors = colors;

  s.search.enabled = flag(s.search.enabled, true);
  s.search.engine = ENGINE_IDS.has(s.search.engine) ? s.search.engine : "duckduckgo";
  s.search.customUrl = String(s.search.customUrl || "").trim().slice(0, 500);
  s.search.placeholder = String(s.search.placeholder || "").slice(0, 80);
  s.search.style = pick(s.search.style, new Set(["pill", "glass", "line", "square"]), "pill");
  s.search.width = clamp(s.search.width, 240, 880);
  s.search.openIn = s.search.openIn === "tab" ? "tab" : "current";

  s.shortcuts.enabled = flag(s.shortcuts.enabled, false);
  s.shortcuts.columns = clamp(Math.round(s.shortcuts.columns), 2, 8);
  s.shortcuts.items = (Array.isArray(s.shortcuts.items) ? s.shortcuts.items : [])
    .slice(0, 24)
    .map(cleanShortcut);

  s.widgets.clock.enabled = flag(s.widgets.clock.enabled, false);
  s.widgets.clock.position = POSITION_SET.has(s.widgets.clock.position) ? s.widgets.clock.position : "top-left";
  s.widgets.clock.format24 = flag(s.widgets.clock.format24, true);
  s.widgets.clock.seconds = flag(s.widgets.clock.seconds, false);
  s.widgets.date.enabled = flag(s.widgets.date.enabled, false);
  s.widgets.date.position = POSITION_SET.has(s.widgets.date.position) ? s.widgets.date.position : "top-left";
  s.widgets.greeting.enabled = flag(s.widgets.greeting.enabled, false);
  s.widgets.greeting.position = POSITION_SET.has(s.widgets.greeting.position)
    ? s.widgets.greeting.position
    : "top-center";
  s.widgets.greeting.name = String(s.widgets.greeting.name || "").slice(0, 40);
  s.widgets.notes.enabled = flag(s.widgets.notes.enabled, false);
  s.widgets.notes.position = POSITION_SET.has(s.widgets.notes.position)
    ? s.widgets.notes.position
    : "bottom-right";
  s.widgets.todo.enabled = flag(s.widgets.todo.enabled, false);
  s.widgets.todo.position = POSITION_SET.has(s.widgets.todo.position) ? s.widgets.todo.position : "bottom-left";

  s.customCss = sanitizeCss(s.customCss);
  s.pinnedTabs.reloadOnStartup = flag(s.pinnedTabs.reloadOnStartup, true);
  s.pinnedTabs.delayMs = clamp(s.pinnedTabs.delayMs, 0, 15000);
  s.pinnedTabs.staggerMs = clamp(s.pinnedTabs.staggerMs, 0, 4000);
  s.pinnedTabs.startupUrls = (Array.isArray(s.pinnedTabs.startupUrls) ? s.pinnedTabs.startupUrls : [])
    .map((url) => String(url || "").trim())
    .filter(isHttpUrl)
    .slice(0, 20);
  s.userPresets = (Array.isArray(s.userPresets) ? s.userPresets : []).map(cleanPreset).filter(Boolean).slice(0, 24);
  return s;
}

export function normalizeTodos(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 40).map((item, index) => ({
    id: typeof item?.id === "string" && item.id.length <= 80 ? item.id : `todo-${index + 1}`,
    text: String(item?.text || "").slice(0, 160),
    done: Boolean(item?.done),
  })).filter((item) => item.text);
}

export function normalizeNotes(text) {
  return String(text || "").slice(0, 8000);
}
