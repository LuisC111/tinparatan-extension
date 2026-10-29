import { sanitizeCss } from "../lib/css-sanitize.js";
import { applyI18n, setLocale, t } from "../lib/i18n.js";
import { mediaUrl } from "../lib/media-db.js";
import { paintShortcutMark } from "../lib/shortcut-icon.js";
import { motionAllowed } from "../lib/motion.js";
import { normalizeNotes, normalizeSettings, normalizeTodos } from "../lib/normalize.js";
import { writePaint } from "../lib/paint.js";
import { engineTemplate, resolveInput, safeHttpUrl } from "../lib/search.js";
import { loadNotes, loadSettings, loadTodos, saveNotes, saveTodos } from "../lib/storage.js";
import { applyThemeVars } from "../lib/theme.js";
import { uid } from "../lib/util.js";
import { paintProfile } from "../lib/profile.js";
import { createEffects } from "./effects.js";
import { createSuggest } from "./suggest-ui.js";

const isPreview = new URLSearchParams(location.search).get("preview") === "1";
const DEFAULT_LOGO = "../assets/logo.png";
const CURSORS = { underscore: "_", block: "▌", bar: "|" };

const logoWrap = document.getElementById("logo-wrap");
const logo = document.getElementById("logo");
const wordmark = document.getElementById("wordmark");
const promptEl = document.getElementById("wm-prompt");
const ghost = document.getElementById("wm-ghost");
const typed = document.getElementById("wm-typed");
const cursor = document.getElementById("wm-cursor");
const sr = document.getElementById("wm-sr");
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("q");
const shortcutsEl = document.getElementById("shortcuts");
const hello = document.getElementById("hello");
const helloPre = document.getElementById("hello-pre");
const uname = document.getElementById("uname");
const customCss = document.getElementById("custom-css");
const video = document.querySelector(".bg-video");
const bgImage = document.querySelector(".bg-image");
const canvas = document.getElementById("fx");
const fx = createEffects(canvas);

let settingsRef = normalizeSettings(null);
let suggest = null;
let suggestSig = "";
let notesText = "";
let todoItems = [];
let typeTimer = 0;
let typeSig = "";
let mediaToken = 0;
let clockTimer = 0;
let notesTimer = 0;
const widgets = {};

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function buildWidgets() {
  widgets.clock = el("p", "widget clock");
  widgets.clock.setAttribute("aria-live", "off");
  widgets.date = el("p", "widget date");
  widgets.greeting = el("p", "widget greeting");

  widgets.notes = el("label", "widget notes");
  const notesLabel = el("span", "widget-label");
  notesLabel.dataset.i18n = "ntp.notesLabel";
  notesLabel.textContent = "Notas";
  widgets.notesInput = document.createElement("textarea");
  widgets.notesInput.rows = 5;
  widgets.notesInput.dataset.i18nPlaceholder = "ntp.notesPlaceholder";
  widgets.notesInput.placeholder = "Una nota que se queda aquí…";
  widgets.notes.append(notesLabel, widgets.notesInput);
  widgets.notesInput.addEventListener("input", () => {
    if (isPreview) return;
    notesText = widgets.notesInput.value;
    clearTimeout(notesTimer);
    notesTimer = setTimeout(() => saveNotes(notesText).catch(() => {}), 350);
  });

  widgets.todo = el("section", "widget todo");
  widgets.todoLabel = el("h2", "widget-label");
  widgets.todoLabel.dataset.i18n = "ntp.todoLabel";
  widgets.todoLabel.textContent = "Pendientes";
  widgets.todoList = document.createElement("ul");
  const form = el("form", "todo-form");
  widgets.todoInput = document.createElement("input");
  widgets.todoInput.type = "text";
  widgets.todoInput.maxLength = 160;
  widgets.todoInput.dataset.i18nPlaceholder = "ntp.todoPlaceholder";
  widgets.todoInput.placeholder = "Añadir pendiente";
  widgets.todoInput.setAttribute("aria-label", "Añadir pendiente");
  const add = document.createElement("button");
  add.type = "submit";
  add.dataset.i18n = "ntp.todoAdd";
  add.textContent = "Añadir";
  form.append(widgets.todoInput, add);
  widgets.todo.append(widgets.todoLabel, widgets.todoList, form);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (isPreview) return;
    const text = widgets.todoInput.value.trim();
    if (!text) return;
    todoItems = [{ id: uid("todo"), text, done: false }, ...todoItems].slice(0, 40);
    widgets.todoInput.value = "";
    renderTodos();
    saveTodos(todoItems).catch(() => {});
  });

  widgets.todoList.addEventListener("change", (event) => {
    if (isPreview) return;
    const row = event.target.closest("li");
    if (!row || event.target.type !== "checkbox") return;
    const item = todoItems.find((entry) => entry.id === row.dataset.id);
    if (!item) return;
    item.done = event.target.checked;
    row.classList.toggle("is-done", item.done);
    saveTodos(todoItems).catch(() => {});
  });
  widgets.todoList.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || isPreview) return;
    todoItems = todoItems.filter((item) => item.id !== button.dataset.id);
    renderTodos();
    saveTodos(todoItems).catch(() => {});
  });
}

function renderTodos() {
  widgets.todoList.replaceChildren();
  for (const item of todoItems) {
    const li = el("li", item.done ? "is-done" : "");
    li.dataset.id = item.id;
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = item.done;
    const label = document.createElement("span");
    label.textContent = item.text;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.id = item.id;
    remove.dataset.i18nAria = "ntp.remove";
    remove.setAttribute("aria-label", t("ntp.remove"));
    remove.textContent = "×";
    li.append(box, label, remove);
    widgets.todoList.append(li);
  }
}

function placeWidgets() {
  document.querySelectorAll(".slot").forEach((slot) => slot.replaceChildren());
  const entries = [
    ["clock", settingsRef.widgets.clock],
    ["date", settingsRef.widgets.date],
    ["greeting", settingsRef.widgets.greeting],
    ["notes", settingsRef.widgets.notes],
    ["todo", settingsRef.widgets.todo],
  ];
  for (const [key, config] of entries) {
    const node = widgets[key];
    node.hidden = !config.enabled;
    if (!config.enabled) continue;
    document.querySelector(`[data-slot="${config.position}"]`)?.append(node);
  }
}

function hourKey(date) {
  const hour = date.getHours();
  if (hour < 12) return "greeting.morning";
  if (hour < 20) return "greeting.afternoon";
  return "greeting.night";
}

function tick() {
  const now = new Date();
  const locale = settingsRef.locale === "en" ? "en" : "es";
  const clock = settingsRef.widgets.clock;
  widgets.clock.textContent = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: clock.seconds ? "2-digit" : undefined,
    hour12: !clock.format24,
  }).format(now);
  widgets.date.textContent = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  const name = settingsRef.widgets.greeting.name.trim();
  const hello = t(hourKey(now));
  widgets.greeting.textContent = name ? `${hello}, ${name}` : hello;
}

function startClock() {
  clearInterval(clockTimer);
  const needs = settingsRef.widgets.clock.enabled || settingsRef.widgets.date.enabled || settingsRef.widgets.greeting.enabled;
  if (!needs || document.hidden) return;
  tick();
  const interval = settingsRef.widgets.clock.enabled && settingsRef.widgets.clock.seconds ? 1000 : 15000;
  clockTimer = setInterval(tick, interval);
}

function startTyping(text) {
  clearTimeout(typeTimer);
  const allow = settingsRef.wordmark.typing && motionAllowed(settingsRef);
  if (!allow) {
    typed.textContent = text;
    document.documentElement.classList.remove("will-type");
    return;
  }
  typed.textContent = "";
  let index = 0;
  const step = () => {
    index += 1;
    typed.textContent = text.slice(0, index);
    if (index < text.length) typeTimer = setTimeout(step, settingsRef.wordmark.typingMs);
  };
  typeTimer = setTimeout(step, 220);
}

function syncWordmark() {
  const word = settingsRef.wordmark;
  const text = word.text || "";
  ghost.textContent = text;
  promptEl.hidden = !word.showPrompt;
  promptEl.textContent = word.prompt || ">";
  sr.textContent = `${word.showPrompt ? word.prompt || ">" : ""}${text}`;
  cursor.hidden = !word.showCursor || word.cursorStyle === "none";
  cursor.textContent = CURSORS[word.cursorStyle] || "_";
  wordmark.hidden = !text && !word.showPrompt;
  const sig = `${text}|${word.typing}|${word.typingMs}|${settingsRef.motion}`;
  if (sig === typeSig) return;
  typeSig = sig;
  startTyping(text);
}

function syncProfile() {
  const profile = settingsRef.profile;
  const name = profile.name.trim();
  hello.hidden = !profile.show || !name;
  if (hello.hidden) return;
  helloPre.hidden = !profile.greet;
  helloPre.textContent = `${t("profile.hello")},`;
  // Re-set the text so one-shot entrance animations (Pop) replay on change.
  if (uname.textContent !== name || uname.dataset.effect !== profile.effect) {
    uname.textContent = name;
    uname.style.animation = "none";
    void uname.offsetWidth;
    uname.style.removeProperty("animation");
  }
  paintProfile(uname, profile);
}

async function syncMedia() {
  const token = ++mediaToken;
  logoWrap.hidden = settingsRef.logo.mode === "none";
  if (settingsRef.logo.mode === "custom") {
    const url = await mediaUrl("logo-custom");
    if (token !== mediaToken) return;
    logo.src = url || DEFAULT_LOGO;
  } else if (settingsRef.logo.mode === "default") {
    logo.src = DEFAULT_LOGO;
  }

  if (settingsRef.background.type === "image") {
    const url = await mediaUrl("bg-image");
    if (token !== mediaToken) return;
    if (url) bgImage.src = url;
    else bgImage.removeAttribute("src");
  } else {
    bgImage.removeAttribute("src");
  }

  if (settingsRef.background.type === "video") {
    const url = await mediaUrl("bg-video");
    if (token !== mediaToken) return;
    if (!url) {
      video.pause();
      if (video.getAttribute("src")) {
        video.removeAttribute("src");
        video.load();
      }
    } else {
      if (video.src !== url) video.src = url;
      if (motionAllowed(settingsRef) && !document.hidden) video.play().catch(() => {});
      else video.pause();
    }
  } else {
    video.pause();
    if (video.getAttribute("src")) {
      video.removeAttribute("src");
      video.load();
    }
  }
}

let shortcutsToken = 0;

function renderShortcuts() {
  const config = settingsRef.shortcuts;
  // Each render gets a token; icon loads from an older render never touch the new grid.
  shortcutsToken += 1;
  const token = shortcutsToken;
  shortcutsEl.hidden = !config.enabled || config.items.length === 0;
  shortcutsEl.replaceChildren();
  if (shortcutsEl.hidden) return;
  for (const item of config.items) {
    const href = safeHttpUrl(item.url);
    if (!href) continue;
    const link = document.createElement("a");
    link.className = "shortcut";
    link.href = href;
    link.dataset.iconType = item.iconType;
    const mark = el("span", "mark");
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = item.title || href.replace(/^https?:\/\//, "").replace(/\/$/, "");
    link.append(mark, label);
    shortcutsEl.append(link);
    paintShortcutMark(mark, item, { isCurrent: () => token === shortcutsToken })
      .then((drawn) => {
        if (drawn !== "stale") link.dataset.drawn = drawn;
      })
      .catch(() => {});
  }
  shortcutsEl.hidden = shortcutsEl.childElementCount === 0;
}

function layout() {
  const stack = document.getElementById("stack");
  const nodes = {
    logo: logoWrap,
    wordmark,
    search: searchForm,
    shortcuts: shortcutsEl,
  };
  for (const id of settingsRef.layout.order) stack.append(nodes[id]);
  // The name rides just above the wordmark wherever the wordmark goes.
  stack.insertBefore(hello, wordmark);
  searchForm.hidden = !settingsRef.search.enabled;
  searchInput.placeholder = settingsRef.search.placeholder || t("ntp.searchPlaceholder");
}

function apply(settings) {
  settingsRef = settings;
  setLocale(settings.locale);
  applyThemeVars(settings);
  customCss.textContent = sanitizeCss(settings.customCss);
  syncWordmark();
  syncProfile();
  layout();
  placeWidgets();
  applyI18n();
  if (document.activeElement !== widgets.notesInput) widgets.notesInput.value = notesText;
  renderTodos();
  tick();
  startClock();
  fx.sync(settings);
  syncMedia();
  renderShortcuts();
  const sig = JSON.stringify(settings.search.suggest);
  if (suggest && sig !== suggestSig) suggest.refresh();
  suggestSig = sig;
  if (!isPreview) writePaint(settings);
}

function bind() {
  document.getElementById("settings-btn").addEventListener("click", () => {
    if (!isPreview) chrome.runtime.openOptionsPage();
  });
  const open = (url) => {
    if (!url || isPreview) return;
    if (settingsRef.search.openIn === "tab") chrome.tabs.create({ url });
    else location.assign(url);
  };
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (isPreview) return;
    open(resolveInput(searchInput.value, engineTemplate(settingsRef)));
  });
  suggest = createSuggest({
    form: searchForm,
    input: searchInput,
    list: document.getElementById("suggest-list"),
    ghost: document.getElementById("ghost-complete"),
    getSettings: () => settingsRef,
    isPreview,
    onOpen: ({ url, text }) => {
      if (url) open(safeHttpUrl(url));
      else open(resolveInput(text, engineTemplate(settingsRef)));
    },
  });
  window.addEventListener("keydown", (event) => {
    if (isPreview || event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = document.activeElement?.tagName;
    const typing = tag === "INPUT" || tag === "TEXTAREA";
    if (event.key === "Escape" && typing) {
      document.activeElement.blur();
      return;
    }
    if (typing) return;
    if (event.key === "/") {
      event.preventDefault();
      searchInput.focus();
      return;
    }
    if (event.key.length === 1 && settingsRef.search.enabled) {
      searchInput.focus();
      searchInput.value = event.key;
      event.preventDefault();
      suggest?.kick();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      fx.pause();
      video.pause();
      clearInterval(clockTimer);
      return;
    }
    fx.resume();
    if (settingsRef.background.type === "video" && motionAllowed(settingsRef)) video.play().catch(() => {});
    startClock();
  });
  let resizeFrame = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => fx.resize());
  }).observe(document.getElementById("bg"));
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  motionQuery.addEventListener?.("change", () => {
    if (settingsRef.motion === "system") apply(settingsRef);
  });
}

function listenStorage() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || isPreview) return;
    if (changes.settings?.newValue) apply(normalizeSettings(changes.settings.newValue));
    if (typeof changes.notes?.newValue === "string" && document.activeElement !== widgets.notesInput) {
      notesText = normalizeNotes(changes.notes.newValue);
      widgets.notesInput.value = notesText;
    }
    if (changes.todos && !widgets.todo.contains(document.activeElement)) {
      todoItems = normalizeTodos(changes.todos.newValue);
      renderTodos();
    }
  });
}

function listenPreview() {
  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin) return;
    if (event.data?.source !== "tinparatan-options" || !event.data.settings) return;
    apply(normalizeSettings(event.data.settings));
  });
  window.parent?.postMessage({ source: "tinparatan-ntp", ready: true }, location.origin);
}

async function init() {
  buildWidgets();
  bind();
  try {
    settingsRef = await loadSettings();
    notesText = await loadNotes();
    todoItems = await loadTodos();
  } catch (error) {
    console.error(error);
    settingsRef = normalizeSettings(null);
  }
  apply(settingsRef);
  if (isPreview) listenPreview();
  else listenStorage();
}

init();
