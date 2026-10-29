// Shared rendering for a shortcut's icon tile (new tab page and settings preview).
// "favicon" uses Chromium's MV3 _favicon endpoint, which reads the browser's own
// local favicon cache: no request leaves the machine.
import { DEFAULT_ICON_TYPE } from "./defaults.js";
import { mediaUrl } from "./media-db.js";
import { safeHttpUrl } from "./search.js";


const FAVICON_SIZE = 64;
// A URL that can never have a cached icon, so Chromium answers with its generic globe.
const PROBE_URL = "https://tinparatan-default-favicon.invalid/";
let defaultSignature = null;

export function faviconUrl(pageUrl, size = FAVICON_SIZE) {
  if (!globalThis.chrome?.runtime?.getURL) return "";
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", String(size));
  return url.toString();
}

export function letterFor(item, href) {
  const title = String(item?.title || "").trim();
  if (title) return Array.from(title)[0].toUpperCase();
  try {
    const host = new URL(href).hostname.replace(/^www\./, "");
    if (host) return host.slice(0, 1).toUpperCase();
  } catch {
    // ignore
  }
  return "?";
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function signature(img) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 24;
    canvas.height = 24;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, 24, 24);
    const data = ctx.getImageData(0, 0, 24, 24).data;
    let hash = 2166136261;
    for (let i = 0; i < data.length; i += 1) {
      // Quantize a little so tiny scaling differences don't matter.
      hash ^= data[i] >> 3;
      hash = Math.imul(hash, 16777619);
    }
    return `${img.naturalWidth}x${img.naturalHeight}:${hash >>> 0}`;
  } catch {
    return "";
  }
}

function getDefaultSignature() {
  if (!defaultSignature) {
    defaultSignature = loadImage(faviconUrl(PROBE_URL)).then((img) => (img ? signature(img) : ""));
  }
  return defaultSignature;
}

// Resolves to an <img> with the site's real favicon, or null when the browser
// has none cached (generic globe), the endpoint is unavailable, or it fails.
export async function loadFavicon(pageUrl) {
  const src = faviconUrl(pageUrl);
  if (!src) return null;
  const [img, generic] = await Promise.all([loadImage(src), getDefaultSignature()]);
  if (!img) return null;
  const sig = signature(img);
  if (generic && sig && sig === generic) return null;
  return img;
}

function setLetter(mark, item, href) {
  mark.classList.remove("is-favicon", "is-image");
  mark.classList.add("is-letter");
  mark.replaceChildren();
  mark.textContent = letterFor(item, href);
}

// Fills `mark` for `item`. Returns "favicon" | "image" | "emoji" | "letter",
// i.e. what was actually drawn (favicon/image fall back to the letter).
export async function paintShortcutMark(mark, item, { isCurrent = () => true } = {}) {
  const href = safeHttpUrl(item?.url) || "";
  mark.classList.remove("is-favicon", "is-image", "is-letter", "is-emoji");
  mark.replaceChildren();
  if (item?.color) mark.style.color = item.color;
  else mark.style.removeProperty("color");
  // Paint the letter immediately so nothing flashes empty while icons load.
  setLetter(mark, item, href);
  const type = item?.iconType || DEFAULT_ICON_TYPE;
  if (type === "emoji" && item.emoji) {
    mark.classList.remove("is-letter");
    mark.classList.add("is-emoji");
    mark.textContent = item.emoji;
    return "emoji";
  }
  if (type === "image" && item.iconId) {
    const url = await mediaUrl(item.iconId).catch(() => "");
    const img = url ? await loadImage(url) : null;
    if (!isCurrent()) return "stale";
    if (img) {
      img.alt = "";
      mark.replaceChildren(img);
      mark.classList.remove("is-letter");
      mark.classList.add("is-image");
      return "image";
    }
    return "letter";
  }
  if (type === "favicon" && href) {
    const img = await loadFavicon(href);
    if (!isCurrent()) return "stale";
    if (img) {
      img.alt = "";
      img.draggable = false;
      mark.replaceChildren(img);
      mark.classList.remove("is-letter");
      mark.classList.add("is-favicon");
      return "favicon";
    }
    return "letter";
  }
  return "letter";
}
