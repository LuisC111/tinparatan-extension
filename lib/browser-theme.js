// Builds Chromium theme extensions (manifest "theme" block) from Tinparatan settings,
// and lists the themes bundled inside this extension.
import { hexToRgb, luminance } from "./color.js";

export const BUNDLED_THEMES = {
  noir: {
    folder: "themes/tinparatan-noir",
    zipName: "tinparatan-noir-theme",
    files: ["manifest.json", "icon-48.png", "icon-128.png", "images/frame.png", "images/frame_inactive.png", "images/toolbar.png"],
  },
  classic: {
    folder: "themes/tinparatan-theme",
    zipName: "tinparatan-theme",
    files: ["manifest.json", "icon-48.png", "icon-128.png"],
  },
};

function parseColor(value, fallback) {
  const hex = hexToRgb(value);
  if (hex) return [hex.r, hex.g, hex.b];
  const m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/.exec(String(value || ""));
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])].map((n) => Math.min(255, n));
  return fallback;
}

function mix(a, b, t) {
  return a.map((channel, i) => Math.round(channel + (b[i] - channel) * t));
}

function toHex(rgb) {
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function lum(rgb) {
  return luminance(toHex(rgb));
}

// Derive every Chromium theme color from the active Tinparatan palette.
export function themeColors(settings) {
  const t = settings?.theme || {};
  const bg = parseColor(t.background, [7, 11, 20]);
  const surface = parseColor(t.surface, [18, 26, 43]);
  const accent = parseColor(t.accent, [225, 29, 46]);
  let text = parseColor(t.text, [245, 247, 251]);
  let muted = parseColor(t.muted, [147, 160, 181]);
  const light = lum(bg) > 0.45;
  // Keep text readable even if the preset has low contrast against the frame.
  if (Math.abs(lum(text) - lum(bg)) < 0.35) text = light ? [20, 22, 28] : [245, 247, 251];
  if (Math.abs(lum(muted) - lum(bg)) < 0.15) muted = mix(text, bg, 0.4);
  const ink = light ? [0, 0, 0] : [255, 255, 255];
  const frame = mix(bg, accent, 0.06);
  const frameInactive = mix(bg, light ? [255, 255, 255] : [0, 0, 0], 0.25);
  const toolbar = mix(bg, surface, 0.55);
  const backgroundTab = mix(frame, ink, 0.03);
  const omnibox = mix(surface, ink, light ? 0.02 : 0.04);
  const incognito = mix(bg, accent, 0.18);
  return {
    frame,
    frame_inactive: frameInactive,
    frame_incognito: incognito,
    frame_incognito_inactive: mix(incognito, [0, 0, 0], 0.25),
    toolbar,
    toolbar_text: text,
    toolbar_button_icon: mix(text, toolbar, 0.12),
    toolbar_separator: mix(toolbar, accent, 0.25),
    bookmark_text: mix(text, toolbar, 0.1),
    tab_text: text,
    tab_background_text: muted,
    tab_background_text_inactive: mix(muted, frame, 0.3),
    tab_background_text_incognito: mix(text, accent, 0.15),
    tab_background_text_incognito_inactive: mix(muted, accent, 0.15),
    background_tab: backgroundTab,
    background_tab_inactive: frameInactive,
    background_tab_incognito: mix(incognito, ink, 0.04),
    background_tab_incognito_inactive: mix(incognito, [0, 0, 0], 0.2),
    omnibox_background: omnibox,
    omnibox_text: text,
    button_background: mix(toolbar, ink, 0.06),
    ntp_background: bg,
    ntp_text: text,
    ntp_link: accent,
  };
}

export function themeManifest(settings, { name = "Tinparatan · Mi tema", version = "1.0.0" } = {}) {
  const preset = String(settings?.theme?.presetId || "custom");
  return {
    manifest_version: 3,
    name: String(name).slice(0, 45),
    version,
    description: `Tema de Chromium generado por Tinparatan (preset: ${preset}). Solo recolorea la interfaz.`.slice(0, 132),
    icons: { 48: "icon-48.png", 128: "icon-128.png" },
    theme: {
      colors: themeColors(settings),
      tints: {
        buttons: [-1, -1, -1],
        frame_inactive: [-1, -1, -1],
        frame_incognito_inactive: [-1, -1, -1],
      },
      properties: { ntp_background_alignment: "center" },
    },
  };
}
