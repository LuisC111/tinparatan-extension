export const ENGINES = [
  { id: "duckduckgo", nameKey: "engines.duckduckgo", url: "https://duckduckgo.com/?q=%s" },
  { id: "google", nameKey: "engines.google", url: "https://www.google.com/search?q=%s" },
  { id: "brave", nameKey: "engines.brave", url: "https://search.brave.com/search?q=%s" },
  { id: "startpage", nameKey: "engines.startpage", url: "https://www.startpage.com/sp/search?query=%s" },
  { id: "bing", nameKey: "engines.bing", url: "https://www.bing.com/search?q=%s" },
  { id: "custom", nameKey: "engines.custom", url: "" },
];

export function engineTemplate(settings) {
  const engine = settings?.search?.engine;
  if (engine === "custom") {
    const raw = String(settings.search.customUrl || "").trim();
    const withToken = raw.includes("%s") ? raw : `${raw}${raw.includes("?") ? "&q=%s" : "?q=%s"}`;
    return safeTemplate(withToken) || ENGINES[0].url;
  }
  return ENGINES.find((item) => item.id === engine)?.url || ENGINES[0].url;
}

export function safeTemplate(template) {
  if (typeof template !== "string" || !template.includes("%s")) return "";
  try {
    const probe = new URL(template.replaceAll("%s", "tinparatan"));
    if (probe.protocol !== "http:" && probe.protocol !== "https:") return "";
    return template;
  } catch {
    return "";
  }
}

export function resolveInput(raw, template) {
  const q = String(raw || "").trim();
  if (!q) return "";
  if (/^helium:\/\//i.test(q) || /^chrome:\/\//i.test(q)) return q;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(q)) {
    try {
      const url = new URL(q);
      if (url.protocol === "http:" || url.protocol === "https:") return url.href;
    } catch {
      /* The text only looks like an address. */
    }
    return fillTemplate(template, q);
  }
  if (/^(localhost|127(?:\.\d{1,3}){3})(?::\d{2,5})?(?:[/?#].*)?$/i.test(q)) {
    try {
      return new URL(`http://${q}`).href;
    } catch {
      return fillTemplate(template, q);
    }
  }
  if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d{2,5})?(?:[/?#].*)?$/i.test(q)) {
    try {
      return new URL(`https://${q}`).href;
    } catch {
      return fillTemplate(template, q);
    }
  }
  return fillTemplate(template, q);
}

function fillTemplate(template, query) {
  const safe = safeTemplate(template) || ENGINES[0].url;
  return safe.replaceAll("%s", encodeURIComponent(query));
}

export function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
}

export function isHttpUrl(value) {
  return Boolean(safeHttpUrl(value));
}
