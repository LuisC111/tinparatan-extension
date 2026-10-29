import { normalizeSettings } from "./normalize.js";

export const PRESETS = [
  {
    id: "tinparatan",
    nameKey: "presets.tinparatan",
    values: {
      theme: {
        accent: "#e11d2e",
        background: "#070b14",
        surface: "#121a2b",
        text: "#f5f7fb",
        muted: "#93a0b5",
        line: "rgba(255,255,255,0.10)",
        prompt: "#e11d2e",
        wordmark: "#f7f8fb",
        searchBg: "rgba(10,14,24,0.78)",
        searchText: "#f5f7fb",
        placeholder: "#8b97ab",
        vignette: 0.48,
      },
      logo: { mode: "default", glow: true, float: true, size: 168 },
      wordmark: {
        fontId: "jetbrains-mono",
        fontSize: 48,
        fontWeight: 500,
        letterSpacing: 0,
        showPrompt: true,
        prompt: ">",
        showCursor: true,
        cursorStyle: "underscore",
        typing: true,
      },
      background: {
        type: "solid",
        color: "#070b14",
        effect: "stars",
        intensity: 0.55,
        blur: 0,
        dim: 0,
        brightness: 1,
      },
      search: { style: "pill", width: 560 },
    },
  },
  {
    id: "eclipse",
    nameKey: "presets.eclipse",
    values: {
      theme: {
        accent: "#ff3140",
        background: "#000000",
        surface: "#101114",
        text: "#f6f7f8",
        muted: "#a1a1aa",
        line: "rgba(255,255,255,0.14)",
        prompt: "#ff3140",
        wordmark: "#ffffff",
        searchBg: "rgba(0,0,0,0.35)",
        searchText: "#ffffff",
        placeholder: "#9b9ba6",
        vignette: 0.72,
      },
      background: {
        type: "effect",
        effect: "stars",
        color: "#000000",
        intensity: 0.9,
        dim: 0.12,
        brightness: 1,
        blur: 0,
      },
      wordmark: { fontId: "jetbrains-mono", fontSize: 46, cursorStyle: "block", fontWeight: 500 },
      search: { style: "line" },
    },
  },
  {
    id: "aurora",
    nameKey: "presets.aurora",
    values: {
      theme: {
        accent: "#8b7cff",
        background: "#071018",
        surface: "#122033",
        text: "#f4f7ff",
        muted: "#a9b7cc",
        line: "rgba(190,205,255,0.18)",
        prompt: "#a494ff",
        wordmark: "#f7f5ff",
        searchBg: "rgba(10,18,32,0.48)",
        searchText: "#f4f7ff",
        placeholder: "#b3c0d4",
        vignette: 0.38,
      },
      background: {
        type: "effect",
        effect: "aurora",
        color: "#071018",
        intensity: 0.85,
        dim: 0.22,
        brightness: 1,
        blur: 0,
        gradient: { colors: ["#1d4e89", "#6d28d9", "#0f766e"], angle: 125, animate: true },
      },
      wordmark: { fontId: "space-grotesk", fontSize: 54, fontWeight: 500, letterSpacing: -0.6 },
      search: { style: "glass" },
    },
  },
  {
    id: "brasas",
    nameKey: "presets.brasas",
    values: {
      theme: {
        accent: "#ff6a2c",
        background: "#140c09",
        surface: "#2a1610",
        text: "#fff3ea",
        muted: "#d0b2a2",
        line: "rgba(255,186,150,0.18)",
        prompt: "#ff7a3c",
        wordmark: "#fff6ef",
        searchBg: "rgba(32,16,12,0.72)",
        searchText: "#fff6ef",
        placeholder: "#c9aa9b",
        vignette: 0.55,
      },
      background: {
        type: "effect",
        effect: "embers",
        color: "#140c09",
        intensity: 0.8,
        dim: 0.18,
        brightness: 1,
        blur: 0,
        gradient: { colors: ["#3b140c", "#8a2e12", "#1a0c08"], angle: 200, animate: true },
      },
      wordmark: { fontId: "fraunces", fontSize: 56, fontWeight: 500, cursorStyle: "bar" },
      search: { style: "pill" },
    },
  },
  {
    id: "fosforo",
    nameKey: "presets.fosforo",
    values: {
      theme: {
        accent: "#3dff8a",
        background: "#010806",
        surface: "#062016",
        text: "#e7fff2",
        muted: "#8fceab",
        line: "rgba(90,255,160,0.18)",
        prompt: "#3dff8a",
        wordmark: "#edfff5",
        searchBg: "rgba(1,14,9,0.82)",
        searchText: "#edfff5",
        placeholder: "#7eb497",
        vignette: 0.45,
      },
      background: {
        type: "effect",
        effect: "matrix",
        color: "#010806",
        intensity: 0.72,
        dim: 0.25,
        brightness: 1,
        blur: 0,
      },
      wordmark: { fontId: "ibm-plex-mono", fontSize: 42, cursorStyle: "block", letterSpacing: 0.4 },
      search: { style: "square" },
    },
  },
  {
    id: "porcelana",
    nameKey: "presets.porcelana",
    values: {
      theme: {
        accent: "#d31228",
        background: "#f4efe8",
        surface: "#fffdfb",
        text: "#1c140f",
        muted: "#6e625a",
        line: "rgba(48,28,20,0.12)",
        prompt: "#d31228",
        wordmark: "#1a120e",
        searchBg: "rgba(255,253,251,0.88)",
        searchText: "#1c140f",
        placeholder: "#8a7c72",
        vignette: 0.16,
      },
      logo: { glow: false },
      background: {
        type: "gradient",
        color: "#f4efe8",
        dim: 0,
        brightness: 1,
        blur: 0,
        gradient: { colors: ["#f7f1e8", "#f6e3ea", "#e5eef8"], angle: 155, animate: true },
      },
      wordmark: { fontId: "fraunces", fontSize: 54, fontWeight: 500 },
      search: { style: "pill" },
    },
  },
];

export function findPreset(settings, id) {
  return PRESETS.find((preset) => preset.id === id) || settings?.userPresets?.find((preset) => preset.id === id) || null;
}

export function applyVisualPreset(settings, preset) {
  const next = normalizeSettings(settings);
  const values = preset?.values || {};
  if (values.theme) Object.assign(next.theme, values.theme);
  next.theme.presetId = preset?.id || "custom";
  if (values.logo) Object.assign(next.logo, values.logo);
  if (values.wordmark) Object.assign(next.wordmark, values.wordmark);
  if (values.layout) {
    Object.assign(next.layout, values.layout);
    if (Array.isArray(values.layout.order)) next.layout.order = [...values.layout.order];
  }
  if (values.background) {
    const imageId = next.background.imageId;
    const videoId = next.background.videoId;
    const previousGradient = { ...next.background.gradient, colors: [...next.background.gradient.colors] };
    Object.assign(next.background, values.background);
    next.background.gradient = {
      ...previousGradient,
      ...(values.background.gradient || {}),
      colors: values.background.gradient?.colors
        ? [...values.background.gradient.colors]
        : [...previousGradient.colors],
    };
    if (!Object.prototype.hasOwnProperty.call(values.background, "imageId")) next.background.imageId = imageId;
    if (!Object.prototype.hasOwnProperty.call(values.background, "videoId")) next.background.videoId = videoId;
  }
  if (values.search) Object.assign(next.search, values.search);
  return normalizeSettings(next);
}

export function snapshotVisual(settings, name) {
  const current = normalizeSettings(settings);
  return {
    id: `user-${Date.now().toString(36)}`,
    name: String(name || "").trim().slice(0, 40),
    values: {
      theme: { ...current.theme },
      logo: {
        mode: current.logo.mode,
        size: current.logo.size,
        glow: current.logo.glow,
        float: current.logo.float,
      },
      wordmark: { ...current.wordmark },
      layout: { ...current.layout, order: [...current.layout.order] },
      background: {
        ...current.background,
        gradient: { ...current.background.gradient, colors: [...current.background.gradient.colors] },
      },
      search: { style: current.search.style, width: current.search.width },
    },
  };
}
