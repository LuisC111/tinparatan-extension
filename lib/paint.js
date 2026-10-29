import { isLight } from "./color.js";

export const PAINT_KEY = "tinp-paint";

export function toPaint(settings) {
  const bg = settings.background.type === "solid" ? settings.background.color : settings.theme.background;
  return {
    bg,
    text: settings.theme.text,
    accent: settings.theme.accent,
    muted: settings.theme.muted,
    surface: settings.theme.surface,
    prompt: settings.theme.prompt,
    wordmark: settings.theme.wordmark,
    searchBg: settings.theme.searchBg,
    searchText: settings.theme.searchText,
    placeholder: settings.theme.placeholder,
    line: settings.theme.line,
    vignette: settings.theme.vignette,
    motion: settings.motion,
    typing: settings.wordmark.typing,
    scheme: isLight(bg) ? "light" : "dark",
    bgType: settings.background.type,
  };
}

export function writePaint(settings) {
  try {
    localStorage.setItem(PAINT_KEY, JSON.stringify(toPaint(settings)));
  } catch {
    /* Storage can be unavailable in private contexts. The default theme still paints. */
  }
}

export function clearPaint() {
  try {
    localStorage.removeItem(PAINT_KEY);
  } catch {
    /* ignore */
  }
}
