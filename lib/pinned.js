import { safeHttpUrl } from "./search.js";

export function normalizeUrl(raw) {
  const href = safeHttpUrl(raw);
  if (!href) return "";
  const url = new URL(href);
  url.hash = "";
  let text = url.toString();
  if (text.endsWith("/") && url.pathname !== "/") text = text.slice(0, -1);
  return text;
}

export function isHttpUrl(raw) {
  return Boolean(safeHttpUrl(raw));
}

export function planStartupTabs(tabs, desiredUrls) {
  const pin = [];
  const create = [];
  const seen = new Set();
  const byUrl = new Map();
  for (const tab of tabs || []) {
    const key = normalizeUrl(tab?.pendingUrl || tab?.url || "");
    if (key && !byUrl.has(key)) byUrl.set(key, tab);
  }
  for (const raw of desiredUrls || []) {
    if (!isHttpUrl(raw)) continue;
    const key = normalizeUrl(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const existing = byUrl.get(key);
    if (!existing) create.push(safeHttpUrl(raw));
    else if (!existing.pinned && existing.id != null) pin.push(existing.id);
  }
  return { pin, create };
}

export function tabsNeedingReload(tabs) {
  return (tabs || []).filter(
    (tab) => tab && tab.pinned && tab.id != null && (tab.discarded === true || tab.status === "unloaded"),
  );
}
