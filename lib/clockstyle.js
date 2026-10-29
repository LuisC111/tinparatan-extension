// Clock and date: formatting and the shared text-style (font, effect, color…).

import { PROFILE_EFFECTS, PROFILE_FONTS } from "./profile.js";

export const AMPM_STYLES = ["full", "short", "hidden"];
export const DATE_FORMATS = ["long", "plain", "full", "numeric", "short"];
export const DATE_CASES = ["title", "sentence", "lower", "upper"];
/** "plain" = theme color, no effect (the original look); "time" = time-of-day gradient. */
export const TEXT_EFFECTS = ["plain", ...PROFILE_EFFECTS.map((effect) => effect.id), "time"];
export const TEXT_FONTS = [{ id: "default" }, ...PROFILE_FONTS];

export const CLOCK_STYLE_DEFAULTS = {
  fontId: "default",
  size: 32,
  weight: 500,
  effect: "plain",
  colors: ["#f5f7fb", "#7c5cff"],
  letterSpacing: -0.04,
  opacity: 100,
};
export const DATE_STYLE_DEFAULTS = {
  fontId: "default",
  size: 13,
  weight: 400,
  effect: "plain",
  colors: ["#93a0b5", "#7c5cff"],
  letterSpacing: 0.01,
  opacity: 100,
};

const HEX = /^#[0-9a-f]{6}$/i;
const FONT_IDS = new Set(TEXT_FONTS.map((font) => font.id));
const num = (value, min, max, fallback, step = 1) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const clamped = Math.min(max, Math.max(min, n));
  return Math.round(clamped / step) * step;
};

export function normalizeTextStyle(raw, defaults, { minSize, maxSize }) {
  const src = raw && typeof raw === "object" ? raw : {};
  const colors = Array.isArray(src.colors) ? src.colors : [];
  return {
    fontId: FONT_IDS.has(src.fontId) ? src.fontId : defaults.fontId,
    size: num(src.size, minSize, maxSize, defaults.size),
    weight: num(src.weight, 100, 900, defaults.weight, 100),
    effect: TEXT_EFFECTS.includes(src.effect) ? src.effect : defaults.effect,
    colors: [0, 1].map((i) => (HEX.test(colors[i]) ? colors[i].toLowerCase() : defaults.colors[i])),
    letterSpacing: Number(num(src.letterSpacing, -0.1, 0.4, defaults.letterSpacing, 0.01).toFixed(2)),
    opacity: num(src.opacity, 20, 100, defaults.opacity),
  };
}

const pad = (n) => String(n).padStart(2, "0");

/** { time: "21:15", period: "" } or { time: "9:15", period: "p. m." }. */
export function formatClock(date, { format24 = true, seconds = false, ampm = "full" } = {}, locale = "es") {
  const h = date.getHours();
  const tail = `${pad(date.getMinutes())}${seconds ? `:${pad(date.getSeconds())}` : ""}`;
  if (format24) return { time: `${pad(h)}:${tail}`, period: "" };
  const pm = h >= 12;
  const hour12 = h % 12 || 12;
  let period = "";
  if (ampm === "full") period = locale === "en" ? (pm ? "PM" : "AM") : pm ? "p.\u00a0m." : "a.\u00a0m.";
  else if (ampm === "short") period = pm ? "pm" : "am";
  return { time: `${hour12}:${tail}`, period };
}

function applyCase(text, mode, locale) {
  const lower = text.toLocaleLowerCase(locale);
  if (mode === "lower") return lower;
  if (mode === "upper") return text.toLocaleUpperCase(locale);
  if (mode === "sentence") return lower.charAt(0).toLocaleUpperCase(locale) + lower.slice(1);
  // title: every word, like the original CSS text-transform: capitalize.
  return lower.replace(/(^|[\s/(-])(\p{L})/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase(locale));
}

const strip = (text) => text.replace(/\.$/, "");

/** Date in one of DATE_FORMATS, cased with one of DATE_CASES. */
export function formatDate(date, format = "long", casing = "title", locale = "es") {
  const loc = locale === "en" ? "en" : "es";
  const part = (options) => new Intl.DateTimeFormat(loc, options).format(date);
  let text;
  switch (format) {
    case "numeric":
      // Digits only: casing does not apply.
      return part({ day: "2-digit", month: "2-digit", year: "numeric" });
    case "short":
      text = loc === "en"
        ? `${strip(part({ weekday: "short" }))} ${strip(part({ month: "short" }))} ${date.getDate()}`
        : `${strip(part({ weekday: "short" }))} ${date.getDate()} ${strip(part({ month: "short" }))}`;
      break;
    case "full":
      text = part({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
      break;
    case "plain":
      text = part({ weekday: "long", day: "numeric", month: "long" }).replace(",", "");
      break;
    default:
      text = part({ weekday: "long", day: "numeric", month: "long" });
  }
  return applyCase(text, DATE_CASES.includes(casing) ? casing : "title", loc);
}

/**
 * Paint a clock/date element. baseFamily is the theme font used for "default".
 * phase is the current greeting phase (for the "time" effect).
 */
export function paintTextStyle(el, style, { baseFamily, phase }) {
  const font = TEXT_FONTS.find((entry) => entry.id === style.fontId);
  const scale = style.fontId === "press-start" ? 0.62 : style.fontId === "bebas-neue" ? 1.18 : 1;
  const isEffect = style.effect !== "plain" && style.effect !== "time";
  el.classList.toggle("uname", isEffect);
  el.classList.toggle("is-timed", style.effect === "time");
  if (isEffect) el.dataset.effect = style.effect;
  else delete el.dataset.effect;
  el.dataset.font = style.fontId;
  el.dataset.phase = phase || "noche";
  el.style.setProperty("--u1", style.colors[0]);
  el.style.setProperty("--u2", style.colors[1]);
  el.style.fontFamily = font?.family || baseFamily;
  el.style.fontWeight = String(style.weight);
  el.style.fontSize = `${Math.round(style.size * scale * 10) / 10}px`;
  el.style.letterSpacing = `${style.letterSpacing}em`;
  el.style.opacity = String(style.opacity / 100);
  el.style.color = "";
}
