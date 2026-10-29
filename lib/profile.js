// Discord-style display name: fonts, effects, colors and the randomizer.

export const PROFILE_FONTS = [
  { id: "montserrat", label: "Montserrat", family: '"TP Montserrat", Inter, system-ui, sans-serif', weight: 800, style: "sans" },
  { id: "playfair", label: "Playfair", family: '"TP Playfair", Georgia, serif', weight: 700, style: "serif" },
  { id: "unifraktur", label: "Gótica", family: '"TP Unifraktur", "Old English Text MT", serif', weight: 400, style: "gothic" },
  { id: "pacifico", label: "Pacifico", family: '"TP Pacifico", cursive', weight: 400, style: "script" },
  { id: "caveat", label: "Caveat", family: '"TP Caveat", cursive', weight: 700, style: "hand" },
  { id: "jetbrains-mono", label: "Mono", family: '"JetBrains Mono", ui-monospace, monospace', weight: 500, style: "mono" },
  { id: "fredoka", label: "Fredoka", family: '"TP Fredoka", system-ui, sans-serif', weight: 600, style: "rounded" },
  { id: "bebas-neue", label: "Bebas", family: '"TP Bebas Neue", Impact, sans-serif', weight: 400, style: "display" },
  { id: "press-start", label: "Pixel", family: '"TP Press Start", monospace', weight: 400, style: "pixel" },
  { id: "bangers", label: "Bangers", family: '"TP Bangers", Impact, sans-serif', weight: 400, style: "comic" },
  { id: "orbitron", label: "Orbitron", family: '"TP Orbitron", system-ui, sans-serif', weight: 800, style: "tech" },
  { id: "lobster", label: "Lobster", family: '"TP Lobster", cursive', weight: 400, style: "retro" },
];

export const PROFILE_EFFECTS = [
  { id: "solid", colors: 1 },
  { id: "gradient", colors: 2 },
  { id: "neon", colors: 1 },
  { id: "cartoon", colors: 1 },
  { id: "pop", colors: 2 },
  { id: "jelly", colors: 2 },
  { id: "prism", colors: 0 },
];

export const GRADIENT_SWATCHES = [
  ["#ff3b5c", "#7c5cff"],
  ["#e11d2e", "#ffb020"],
  ["#00e5ff", "#7c4dff"],
  ["#22d3a6", "#2563eb"],
  ["#ff7ac6", "#ffd36e"],
  ["#a3e635", "#06b6d4"],
  ["#f97316", "#db2777"],
  ["#f5f7fb", "#93a0b5"],
];

export const PROFILE_DEFAULTS = {
  show: true,
  name: "",
  greet: true,
  fontId: "montserrat",
  effect: "neon",
  colors: ["#ff3b5c", "#7c5cff"],
  size: 30,
  greetText: "",
  greetGradient: true,
  placement: "between",
};

export const GREETING_PLACEMENTS = ["above-logo", "between", "below-wordmark", "below-search"];

const FONT_IDS = new Set(PROFILE_FONTS.map((font) => font.id));
const EFFECT_IDS = new Set(PROFILE_EFFECTS.map((effect) => effect.id));
const HEX = /^#[0-9a-f]{6}$/i;

export function profileFont(id) {
  return PROFILE_FONTS.find((font) => font.id === id) || PROFILE_FONTS[0];
}

export function normalizeProfile(raw, fallbackName = "") {
  const src = raw && typeof raw === "object" ? raw : {};
  const colors = Array.isArray(src.colors) ? src.colors : [];
  const size = Number(src.size);
  const hasName = typeof src.name === "string";
  return {
    show: typeof src.show === "boolean" ? src.show : PROFILE_DEFAULTS.show,
    name: (hasName ? src.name : String(fallbackName || "")).replace(/[\u0000-\u001f]/g, "").slice(0, 32),
    greet: typeof src.greet === "boolean" ? src.greet : PROFILE_DEFAULTS.greet,
    fontId: FONT_IDS.has(src.fontId) ? src.fontId : PROFILE_DEFAULTS.fontId,
    effect: EFFECT_IDS.has(src.effect) ? src.effect : PROFILE_DEFAULTS.effect,
    colors: [0, 1].map((i) => (HEX.test(colors[i]) ? colors[i].toLowerCase() : PROFILE_DEFAULTS.colors[i])),
    size: Number.isFinite(size) ? Math.min(56, Math.max(16, Math.round(size))) : PROFILE_DEFAULTS.size,
    greetText: typeof src.greetText === "string" ? src.greetText.replace(/[\u0000-\u001f]/g, "").slice(0, 40) : "",
    greetGradient: typeof src.greetGradient === "boolean" ? src.greetGradient : PROFILE_DEFAULTS.greetGradient,
    placement: GREETING_PLACEMENTS.includes(src.placement) ? src.placement : PROFILE_DEFAULTS.placement,
  };
}

function hslHex(h, s, l) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Random font/effect/colors; keeps the name and visibility. rand() in [0, 1). */
export function randomizeProfile(profile, rand = Math.random) {
  const base = normalizeProfile(profile);
  const pickOne = (list) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  let fontId = pickOne(PROFILE_FONTS).id;
  let effect = pickOne(PROFILE_EFFECTS).id;
  // Always land on something different from what is shown now.
  if (fontId === base.fontId && effect === base.effect) {
    effect = PROFILE_EFFECTS[(PROFILE_EFFECTS.findIndex((e) => e.id === effect) + 1) % PROFILE_EFFECTS.length].id;
  }
  let colors;
  if (rand() < 0.45) {
    colors = [...pickOne(GRADIENT_SWATCHES)];
  } else {
    const hue = Math.floor(rand() * 360);
    const shift = 40 + Math.floor(rand() * 140);
    colors = [hslHex(hue, 88, 62), hslHex((hue + shift) % 360, 84, 58)];
  }
  return normalizeProfile({ ...base, fontId, effect, colors });
}

/** Paint a name element (and optional greeting) from a normalized profile. */
export function paintProfile(el, profile) {
  const font = profileFont(profile.fontId);
  el.dataset.effect = profile.effect;
  el.dataset.font = font.id;
  el.style.setProperty("--u-font", font.family);
  el.style.setProperty("--u-weight", String(font.weight));
  el.style.setProperty("--u1", profile.colors[0]);
  el.style.setProperty("--u2", profile.colors[1]);
  el.style.setProperty("--u-size", `${profile.size}px`);
  // Pixel/blackletter faces read smaller or larger at the same px size.
  el.style.setProperty("--u-scale", font.id === "press-start" ? "0.62" : font.id === "bebas-neue" ? "1.18" : "1");
}
