// Search suggestions: pure helpers (URL building, parsing, merging) shared by the
// new tab page and the tests. Network access lives in newtab/suggest-ui.js.

export const SUGGEST_ENGINES = [
  { id: "google", nameKey: "suggest.engines.google" },
  { id: "duckduckgo", nameKey: "suggest.engines.duckduckgo" },
  { id: "brave", nameKey: "suggest.engines.brave" },
  { id: "off", nameKey: "suggest.engines.off" },
];

export const SUGGEST_ENGINE_IDS = SUGGEST_ENGINES.map((engine) => engine.id);
export const SUGGEST_HOSTS = [
  "https://suggestqueries.google.com/complete/*",
  "https://duckduckgo.com/ac/*",
  "https://search.brave.com/api/suggest*",
];

const MAX_QUERY = 200;

/** "es-CO" -> { hl: "es-CO", lang: "es", region: "co" } */
export function localeParts(language) {
  const raw = String(language || "es").trim().replace("_", "-");
  const match = /^([a-z]{2,3})(?:-([a-z]{2}|\d{3}))?/i.exec(raw);
  const lang = (match?.[1] || "es").toLowerCase();
  const region = (match?.[2] || "").toLowerCase();
  return { hl: region ? `${lang}-${region.toUpperCase()}` : lang, lang, region };
}

export function buildSuggestUrl(engine, query, language) {
  const q = String(query || "").slice(0, MAX_QUERY);
  if (!q.trim()) return "";
  const { hl, lang, region } = localeParts(language);
  const enc = encodeURIComponent(q);
  switch (engine) {
    case "google":
      // ie/oe force UTF-8; without them Google answers ISO-8859-1 for some locales.
      return `https://suggestqueries.google.com/complete/search?client=chrome&hl=${encodeURIComponent(hl)}&ie=utf-8&oe=utf-8&q=${enc}`;
    case "duckduckgo":
      return `https://duckduckgo.com/ac/?q=${enc}&type=list${region ? `&kl=${region}-${lang}` : ""}`;
    case "brave":
      return `https://search.brave.com/api/suggest?q=${enc}`;
    default:
      return "";
  }
}

/** Decode a response body honoring the charset in Content-Type (defaults to UTF-8). */
export function decodeBody(buffer, contentType) {
  const match = /charset\s*=\s*"?([\w.:-]+)/i.exec(String(contentType || ""));
  let label = (match?.[1] || "utf-8").toLowerCase();
  try {
    return new TextDecoder(label).decode(buffer);
  } catch {
    label = "utf-8";
    return new TextDecoder(label).decode(buffer);
  }
}

function cleanText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY) : "";
}

/**
 * Normalize an engine payload into [{ kind: "search" | "url", text }].
 * Google (client=chrome): [q, [s...], [desc...], [], { "google:suggesttype": [...] }]
 * DuckDuckGo (type=list) and Brave: [q, [s...]]
 */
export function parseSuggestions(engine, payload, limit = 8) {
  let data = payload;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }
  // Older DuckDuckGo format: [{ phrase: "..." }]
  if (Array.isArray(data) && data.length && data.every((item) => item && typeof item === "object" && "phrase" in item)) {
    data = ["", data.map((item) => item.phrase)];
  }
  if (!Array.isArray(data) || !Array.isArray(data[1])) return [];
  const types = engine === "google" && data[4] && typeof data[4] === "object" ? data[4]["google:suggesttype"] : null;
  const out = [];
  const seen = new Set();
  data[1].forEach((raw, index) => {
    const text = cleanText(raw);
    if (!text) return;
    const kind = Array.isArray(types) && types[index] === "NAVIGATION" ? "url" : "search";
    const key = `${kind}:${text.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, text });
  });
  return out.slice(0, limit);
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeKey(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}${parsed.search}`.toLowerCase();
  } catch {
    return String(url || "").toLowerCase();
  }
}

/** Score 0 = no match. Prefix matches beat substring matches. */
function scoreMatch(haystacks, q) {
  let best = 0;
  for (const value of haystacks) {
    const text = String(value || "").toLowerCase();
    if (!text) continue;
    if (text.startsWith(q)) best = Math.max(best, 3);
    else if (text.split(/[\s./_-]+/).some((word) => word.startsWith(q))) best = Math.max(best, 2);
    else if (q.length >= 2 && text.includes(q)) best = Math.max(best, 1);
  }
  return best;
}

export function matchShortcuts(items, query, limit = 3) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  return (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const host = hostOf(item?.url);
      if (!host) return null;
      const score = scoreMatch([item.title, host, host.split(".")[0]], q);
      return score ? { kind: "shortcut", text: item.title || host, url: item.url, sub: host, item, score, index } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ score, index, ...rest }) => rest);
}

export function matchHistory(entries, query, limit = 3) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  return (Array.isArray(entries) ? entries : [])
    .map((entry, index) => {
      const host = hostOf(entry?.url);
      if (!host || !/^https?:/i.test(entry.url)) return null;
      const score = scoreMatch([entry.title, host, entry.url.replace(/^https?:\/\/(www\.)?/i, "")], q);
      const weight = Number(entry.visitCount || 0) + Number(entry.typedCount || 0) * 3;
      return score ? { kind: "history", text: cleanText(entry.title) || host, url: entry.url, sub: host, score, weight, index } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || b.weight - a.weight || a.index - b.index)
    .slice(0, limit)
    .map(({ score, weight, index, ...rest }) => rest);
}

/**
 * Shortcuts first, then history, then remote suggestions. URLs are deduped by
 * host+path and text suggestions case-insensitively; a remote "url" suggestion
 * that points at a shortcut/history site is dropped.
 */
export function mergeSuggestions({ query, remote = [], shortcuts = [], history = [], limit = 8 }) {
  const q = String(query || "").trim().toLowerCase();
  const out = [];
  const urlKeys = new Set();
  const textKeys = new Set();
  const hosts = new Set();
  const push = (entry) => {
    if (out.length >= limit) return;
    if (entry.url) {
      const key = normalizeKey(entry.url);
      if (urlKeys.has(key)) return;
      urlKeys.add(key);
      hosts.add(hostOf(entry.url));
    }
    out.push(entry);
  };
  shortcuts.slice(0, 3).forEach(push);
  history.slice(0, 3).forEach(push);
  for (const entry of remote) {
    if (entry.kind === "url") {
      const href = /^[a-z][a-z0-9+.-]*:\/\//i.test(entry.text) ? entry.text : `https://${entry.text}`;
      const host = hostOf(href);
      if (!host || hosts.has(host)) continue;
      push({ kind: "url", text: entry.text.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, ""), url: href });
      continue;
    }
    const key = entry.text.toLowerCase();
    if (textKeys.has(key) || (key === q && remote.length > 1)) {
      textKeys.add(key);
      continue;
    }
    textKeys.add(key);
    push({ kind: "search", text: entry.text });
  }
  return out;
}

/** Split text into [{ text, match }] parts highlighting the first occurrence of query. */
export function highlightParts(text, query) {
  const value = String(text || "");
  const q = String(query || "").trim();
  if (!q) return [{ text: value, match: false }];
  const at = value.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return [{ text: value, match: false }];
  const parts = [];
  if (at > 0) parts.push({ text: value.slice(0, at), match: false });
  parts.push({ text: value.slice(at, at + q.length), match: true });
  if (at + q.length < value.length) parts.push({ text: value.slice(at + q.length), match: false });
  return parts;
}

/**
 * The text Tab would complete to, if the first suggestion extends what was typed.
 * Keeps the user's own casing for the typed prefix.
 */
export function inlineCompletion(typed, suggestions) {
  const raw = String(typed || "");
  if (!raw.trim()) return "";
  const lower = raw.toLowerCase();
  for (const entry of suggestions || []) {
    const candidate = entry.kind === "search" || entry.kind === "url" ? entry.text : entry.sub || "";
    if (candidate.length > raw.length && candidate.toLowerCase().startsWith(lower)) return raw + candidate.slice(raw.length);
  }
  return "";
}

/** What Tab puts in the input for a given entry. */
export function acceptText(entry) {
  if (!entry) return "";
  if (entry.kind === "search") return entry.text;
  if (entry.kind === "url") return entry.text;
  return entry.url || entry.text;
}
