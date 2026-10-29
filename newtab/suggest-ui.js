import { t } from "../lib/i18n.js";
import {
  acceptText,
  buildSuggestUrl,
  decodeBody,
  highlightParts,
  inlineCompletion,
  matchHistory,
  matchShortcuts,
  mergeSuggestions,
  parseSuggestions,
} from "../lib/suggest.js";
import { paintShortcutMark } from "../lib/shortcut-icon.js";

const DEBOUNCE_MS = 120;
const CACHE_MAX = 60;

const ICONS = {
  search:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  url:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>',
  history:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>',
};

/** Fetch suggestions for one engine. Falls back to the service worker if the page fetch is refused. */
async function fetchRemote(engine, query, signal) {
  const language = navigator.language || "es";
  const url = buildSuggestUrl(engine, query, language);
  if (!url) return [];
  try {
    const response = await fetch(url, { signal, credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" });
    if (!response.ok) return [];
    const text = decodeBody(await response.arrayBuffer(), response.headers.get("content-type"));
    return parseSuggestions(engine, text);
  } catch (error) {
    if (signal.aborted || error?.name === "AbortError") throw error;
    const reply = await chrome.runtime.sendMessage({ type: "tinp-suggest", engine, query, language }).catch(() => null);
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    return reply?.ok ? parseSuggestions(engine, reply.text) : [];
  }
}

async function searchHistory(query) {
  if (!chrome.history?.search) return [];
  try {
    const items = await chrome.history.search({ text: query, maxResults: 24, startTime: 0 });
    return matchHistory(items, query, 3);
  } catch {
    return [];
  }
}

export function createSuggest({ form, input, list, ghost, getSettings, isPreview, onOpen }) {
  const cache = new Map();
  let timer = 0;
  let controller = null;
  let items = [];
  let active = -1;
  let typed = "";
  let seq = 0;

  const config = () => getSettings().search.suggest;

  function setExpanded(open) {
    form.classList.toggle("is-open", open);
    input.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      list.hidden = false;
      requestAnimationFrame(() => list.classList.add("is-shown"));
    } else {
      list.classList.remove("is-shown");
      list.hidden = true;
      input.removeAttribute("aria-activedescendant");
    }
  }

  function close() {
    items = [];
    active = -1;
    list.replaceChildren();
    setExpanded(false);
    paintGhost();
  }

  function paintGhost() {
    if (!ghost) return;
    const value = input.value;
    const completion = active < 0 && document.activeElement === input ? inlineCompletion(value, items) : "";
    const fits = input.scrollWidth <= input.clientWidth + 1;
    const caretAtEnd = input.selectionStart === value.length && input.selectionEnd === value.length;
    // Centered/right text moves as it grows, so an overlay cannot sit after the caret.
    // Tab still accepts the completion; only the grey hint is skipped.
    const leftAligned = (getSettings()?.search?.align || "left") === "left";
    if (!completion || !fits || !caretAtEnd || !leftAligned) {
      ghost.hidden = true;
      return;
    }
    ghost.hidden = false;
    ghost.firstElementChild.textContent = value;
    ghost.lastElementChild.textContent = completion.slice(value.length);
  }

  function row(entry, index) {
    const li = document.createElement("li");
    li.id = `sg-${index}`;
    li.className = `sg sg-${entry.kind}`;
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", "false");
    li.style.setProperty("--i", String(index));
    const icon = document.createElement("span");
    icon.className = "sg-icon";
    if (entry.kind === "shortcut" || entry.kind === "history") {
      const mark = document.createElement("span");
      mark.className = "mark";
      icon.append(mark);
      const item = entry.kind === "shortcut" ? entry.item : { url: entry.url, title: entry.text, iconType: "favicon" };
      paintShortcutMark(mark, item, { isCurrent: () => items.includes(entry) }).catch(() => {});
      if (entry.kind === "history") {
        const badge = document.createElement("span");
        badge.className = "sg-badge";
        badge.innerHTML = ICONS.history;
        icon.append(badge);
      }
    } else {
      icon.innerHTML = ICONS[entry.kind] || ICONS.search;
    }
    const text = document.createElement("span");
    text.className = "sg-text";
    const query = typed.trim();
    for (const part of highlightParts(entry.text, query)) {
      const span = document.createElement(part.match ? "mark" : "span");
      span.textContent = part.text;
      text.append(span);
    }
    li.append(icon, text);
    if (entry.sub && entry.sub !== entry.text) {
      const sub = document.createElement("span");
      sub.className = "sg-sub";
      sub.textContent = entry.sub;
      li.append(sub);
    }
    const tag = document.createElement("span");
    tag.className = "sg-tag";
    tag.textContent = t(`suggest.kind.${entry.kind}`);
    li.append(tag);
    li.addEventListener("pointerdown", (event) => event.preventDefault());
    li.addEventListener("click", () => choose(index));
    li.addEventListener("pointermove", () => {
      if (active !== index) highlight(index, { fromPointer: true });
    });
    return li;
  }

  function render(next) {
    items = next;
    active = -1;
    list.replaceChildren(...items.map(row));
    setExpanded(items.length > 0 && document.activeElement === input);
    paintGhost();
  }

  function highlight(index, { fromPointer = false } = {}) {
    active = index;
    [...list.children].forEach((node, i) => {
      const on = i === index;
      node.classList.toggle("is-active", on);
      node.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (index >= 0) {
      input.setAttribute("aria-activedescendant", `sg-${index}`);
      if (!fromPointer) {
        const entry = items[index];
        input.value = entry.kind === "search" || entry.kind === "url" ? entry.text : typed;
        list.children[index]?.scrollIntoView({ block: "nearest" });
      }
    } else {
      input.removeAttribute("aria-activedescendant");
      if (!fromPointer) input.value = typed;
    }
    paintGhost();
  }

  function choose(index) {
    const entry = items[index];
    if (!entry) return;
    close();
    if (entry.url) onOpen({ url: entry.url });
    else onOpen({ text: entry.text });
  }

  async function update() {
    const query = input.value;
    typed = query;
    const cfg = config();
    const q = query.trim();
    controller?.abort();
    controller = null;
    if (!q || isPreview) {
      close();
      return;
    }
    const mine = ++seq;
    const settings = getSettings();
    const local = cfg.shortcuts && settings.shortcuts.enabled ? matchShortcuts(settings.shortcuts.items, q, 3) : [];
    // Paint local matches at once; the network fills in below.
    const key = `${cfg.engine}|${q.toLowerCase()}`;
    const cached = cache.get(key);
    render(mergeSuggestions({ query: q, shortcuts: local, remote: cached || [] }));
    const history = cfg.history ? await searchHistory(q) : [];
    if (mine !== seq) return;
    let remote = cached || [];
    if (!cached && cfg.engine !== "off") {
      controller = new AbortController();
      try {
        remote = await fetchRemote(cfg.engine, q, controller.signal);
        cache.set(key, remote);
        if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
      } catch {
        return;
      }
    }
    if (mine !== seq || input.value !== query) return;
    const keep = active >= 0 ? items[active] : null;
    render(mergeSuggestions({ query: q, shortcuts: local, history, remote }));
    if (keep) {
      const again = items.findIndex((entry) => entry.text === keep.text && entry.kind === keep.kind);
      if (again >= 0) highlight(again, { fromPointer: true });
    }
  }

  function schedule() {
    clearTimeout(timer);
    if (!input.value.trim()) {
      seq += 1;
      controller?.abort();
      close();
      return;
    }
    timer = setTimeout(update, DEBOUNCE_MS);
  }

  input.addEventListener("input", schedule);
  input.addEventListener("focus", () => {
    if (input.value.trim()) schedule();
  });
  input.addEventListener("blur", () => {
    // Let a click on a row land first.
    setTimeout(() => {
      if (document.activeElement !== input) {
        setExpanded(false);
        if (ghost) ghost.hidden = true;
      }
    }, 120);
  });
  input.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    const open = !list.hidden && items.length > 0;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!items.length) return;
      event.preventDefault();
      if (!open) setExpanded(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      let next = active + step;
      if (next >= items.length) next = -1;
      if (next < -1) next = items.length - 1;
      highlight(next);
      return;
    }
    if (event.key === "Tab" && !event.shiftKey) {
      const entry = active >= 0 ? items[active] : null;
      const completion = inlineCompletion(input.value, items);
      const value = entry ? acceptText(entry) : completion;
      if (!value || value === input.value) return;
      event.preventDefault();
      input.value = value;
      typed = value;
      schedule();
      return;
    }
    if (event.key === "ArrowRight" && ghost && !ghost.hidden && input.selectionStart === input.value.length) {
      event.preventDefault();
      input.value = inlineCompletion(input.value, items);
      schedule();
      return;
    }
    if (event.key === "Escape") {
      if (open || active >= 0) {
        event.preventDefault();
        event.stopPropagation();
        if (active >= 0) input.value = typed;
        close();
      }
      return;
    }
    if (event.key === "Enter" && active >= 0 && open) {
      event.preventDefault();
      choose(active);
    }
  });
  input.addEventListener("keyup", paintGhost);
  input.addEventListener("click", paintGhost);
  form.addEventListener("submit", () => {
    seq += 1;
    controller?.abort();
    close();
  });

  return {
    close,
    refresh() {
      cache.clear();
      if (document.activeElement === input && input.value.trim()) schedule();
      else close();
    },
    /** For the global "type anywhere" handler: show suggestions for programmatic input. */
    kick: schedule,
  };
}
