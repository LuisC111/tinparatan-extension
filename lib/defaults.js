export const POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

// Shortcut icon types. "favicon" = the site's own icon from the browser's local cache.
export const ICON_TYPES = ["favicon", "letter", "emoji", "image"];
export const DEFAULT_ICON_TYPE = "favicon";

export const ORDER_IDS = ["logo", "wordmark", "search", "shortcuts"];

export const DEFAULT_SETTINGS = {
  version: 1,
  locale: "es",
  motion: "system",
  theme: {
    presetId: "tinparatan",
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
  logo: {
    mode: "default",
    mediaId: "logo-custom",
    size: 168,
    glow: true,
    float: true,
  },
  wordmark: {
    text: "tinparatan",
    showPrompt: true,
    prompt: ">",
    showCursor: true,
    cursorStyle: "underscore",
    fontId: "jetbrains-mono",
    fontSize: 48,
    letterSpacing: 0,
    fontWeight: 500,
    typing: true,
    typingMs: 78,
  },
  layout: {
    alignX: "center",
    alignY: "center",
    gap: 26,
    order: ["logo", "wordmark", "search", "shortcuts"],
    offsetY: 1,
  },
  background: {
    type: "solid",
    color: "#070b14",
    gradient: {
      colors: ["#070b14", "#1a0b16", "#0a1830"],
      angle: 160,
      animate: true,
    },
    imageId: "bg-image",
    videoId: "bg-video",
    fit: "cover",
    effect: "stars",
    intensity: 0.7,
    blur: 0,
    dim: 0.28,
    brightness: 1,
  },
  search: {
    enabled: true,
    engine: "duckduckgo",
    customUrl: "https://duckduckgo.com/?q=%s",
    placeholder: "",
    style: "pill",
    width: 560,
    openIn: "current",
  },
  shortcuts: {
    enabled: false,
    columns: 4,
    items: [],
  },
  widgets: {
    clock: { enabled: false, position: "top-left", format24: true, seconds: false },
    date: { enabled: false, position: "top-left" },
    greeting: { enabled: false, position: "top-center", name: "" },
    notes: { enabled: false, position: "bottom-right" },
    todo: { enabled: false, position: "bottom-left" },
  },
  customCss: "",
  pinnedTabs: {
    reloadOnStartup: true,
    delayMs: 700,
    staggerMs: 280,
    startupUrls: [],
  },
  userPresets: [],
};
