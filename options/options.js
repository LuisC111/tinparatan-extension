import { parseBackup, buildBackup } from "../lib/backup.js";
import { applyI18n, setLocale, t } from "../lib/i18n.js";
import { clearMedia, deleteMedia, listMedia, putMedia } from "../lib/media-db.js";
import { normalizeSettings } from "../lib/normalize.js";
import { clearPaint, writePaint } from "../lib/paint.js";
import { PRESETS, applyVisualPreset, snapshotVisual } from "../lib/presets.js";
import { safeHttpUrl } from "../lib/search.js";
import { loadNotes, loadSettings, loadTodos, resetStorage, saveBackupParts, saveSettings } from "../lib/storage.js";
import { applyThemeVars } from "../lib/theme.js";
import { getPath, setPath, uid } from "../lib/util.js";

const POSITIONS = [
  ["top-left", "fields.posTopLeft"],
  ["top-center", "fields.posTopCenter"],
  ["top-right", "fields.posTopRight"],
  ["bottom-left", "fields.posBottomLeft"],
  ["bottom-center", "fields.posBottomCenter"],
  ["bottom-right", "fields.posBottomRight"],
];

const state = { settings: normalizeSettings(null) };
const statusEl = document.getElementById("status");
const preview = document.getElementById("preview");
const previewScale = document.getElementById("preview-scale");
let saveTimer = 0;
let previewReady = false;

function setStatus(key) {
  statusEl.textContent = t(key);
}

function readControl(el) {
  if (el.type === "checkbox") return el.checked;
  if (el.type === "radio") return el.checked ? el.value : undefined;
  if (el.dataset.kind === "number") return Number(el.value);
  return el.value;
}

function fill() {
  document.querySelectorAll("[data-bind]").forEach((el) => {
    const value = getPath(state.settings, el.dataset.bind);
    if (el.type === "radio") el.checked = el.value === String(value);
    else if (el.type === "checkbox") el.checked = Boolean(value);
    else if (value != null) el.value = value;
  });
  updateConditional();
  refreshVals();
  highlightPreset();
  renderOrder();
  renderShortcuts();
  renderUrls();
  renderPresetGrid();
  renderUserPresets();
  applyThemeVars(state.settings);
  applyI18n();
  styleFontOptions();
}

function refreshVals() {
  document.querySelectorAll("[data-val]").forEach((el) => {
    const value = getPath(state.settings, el.dataset.val);
    const number = Number(value);
    const shown = Number.isFinite(number) ? String(Math.round(number * 100) / 100) : String(value ?? "");
    el.textContent = `${shown}${el.dataset.suffix || ""}`;
  });
}

function updateConditional() {
  const type = state.settings.background.type;
  document.querySelectorAll("[data-show-bg]").forEach((el) => {
    el.hidden = !el.dataset.showBg.split(",").includes(type);
  });
  document.querySelectorAll("[data-show-logo]").forEach((el) => {
    el.hidden = state.settings.logo.mode !== el.dataset.showLogo;
  });
  document.querySelectorAll("[data-show-engine]").forEach((el) => {
    el.hidden = state.settings.search.engine !== el.dataset.showEngine;
  });
}

function highlightPreset() {
  const id = state.settings.theme.presetId;
  document.querySelectorAll("[data-preset]").forEach((button) => {
    const active = button.dataset.preset === id;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function paintCopy() {
  setLocale(state.settings.locale);
  document.title = `${t("options.title")} · Tinparatan`;
  applyI18n();
  renderPresetGrid();
  renderUserPresets();
  renderOrder();
  renderShortcuts();
  fillPositionSelects();
  styleFontOptions();
}

function fillPositionSelects() {
  document.querySelectorAll("[data-positions]").forEach((select) => {
    const current = select.value || getPath(state.settings, select.dataset.bind);
    select.replaceChildren();
    for (const [value, key] of POSITIONS) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = t(key);
      select.append(option);
    }
    select.value = current || "top-left";
  });
}

function styleFontOptions() {
  const families = {
    "jetbrains-mono": '"JetBrains Mono", monospace',
    "ibm-plex-mono": '"IBM Plex Mono", monospace',
    "space-grotesk": '"Space Grotesk", sans-serif',
    inter: "Inter, sans-serif",
    fraunces: "Fraunces, serif",
    "system-sans": "system-ui, sans-serif",
    "system-mono": "ui-monospace, monospace",
  };
  for (const option of document.querySelectorAll("#font-select option")) {
    option.style.fontFamily = families[option.value] || "inherit";
  }
}

function renderPresetGrid() {
  const grid = document.getElementById("preset-grid");
  grid.replaceChildren();
  for (const preset of PRESETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset";
    button.dataset.preset = preset.id;
    const theme = preset.values.theme || {};
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = theme.background || "#070b14";
    swatch.style.boxShadow = `inset 0 -30px 36px ${theme.accent || "#e11d2e"}66`;
    const bar = document.createElement("i");
    bar.style.background = theme.wordmark || "#fff";
    swatch.append(bar);
    const name = document.createElement("span");
    name.textContent = t(preset.nameKey);
    button.append(swatch, name);
    button.addEventListener("click", () => {
      state.settings = applyVisualPreset(state.settings, preset);
      fill();
      scheduleSave();
    });
    grid.append(button);
  }
  highlightPreset();
}

function renderUserPresets() {
  const host = document.getElementById("user-presets");
  const empty = document.getElementById("user-presets-empty");
  host.replaceChildren();
  empty.hidden = state.settings.userPresets.length > 0;
  for (const preset of state.settings.userPresets) {
    const wrap = document.createElement("div");
    wrap.className = "user-preset";
    wrap.dataset.preset = preset.id;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.textContent = preset.name;
    button.addEventListener("click", () => {
      state.settings = applyVisualPreset(state.settings, preset);
      fill();
      scheduleSave();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn";
    remove.textContent = t("presets.delete");
    remove.addEventListener("click", () => {
      state.settings.userPresets = state.settings.userPresets.filter((item) => item.id !== preset.id);
      if (state.settings.theme.presetId === preset.id) state.settings.theme.presetId = "custom";
      renderUserPresets();
      highlightPreset();
      scheduleSave();
    });
    wrap.append(button, remove);
    host.append(wrap);
  }
}

function renderOrder() {
  const list = document.getElementById("order-list");
  list.replaceChildren();
  state.settings.layout.order.forEach((id, index) => {
    const row = document.createElement("div");
    row.className = "order-row";
    const label = document.createElement("span");
    label.textContent = t(`order.${id}`);
    const actions = document.createElement("div");
    actions.className = "mini";
    const up = document.createElement("button");
    up.type = "button";
    up.className = "btn";
    up.textContent = "↑";
    up.disabled = index === 0;
    up.setAttribute("aria-label", t("fields.moveUp"));
    up.addEventListener("click", () => moveOrder(index, -1));
    const down = document.createElement("button");
    down.type = "button";
    down.className = "btn";
    down.textContent = "↓";
    down.disabled = index === state.settings.layout.order.length - 1;
    down.setAttribute("aria-label", t("fields.moveDown"));
    down.addEventListener("click", () => moveOrder(index, 1));
    actions.append(up, down);
    row.append(label, actions);
    list.append(row);
  });
}

function moveOrder(index, delta) {
  const order = [...state.settings.layout.order];
  const next = index + delta;
  if (next < 0 || next >= order.length) return;
  [order[index], order[next]] = [order[next], order[index]];
  state.settings.layout.order = order;
  state.settings.theme.presetId = "custom";
  renderOrder();
  highlightPreset();
  scheduleSave();
}

function renderShortcuts() {
  const list = document.getElementById("shortcut-list");
  const empty = document.getElementById("shortcut-empty");
  list.replaceChildren();
  empty.hidden = state.settings.shortcuts.items.length > 0;
  state.settings.shortcuts.items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "item-card";
    const fields = document.createElement("div");
    fields.className = "item-fields";
    const title = document.createElement("input");
    title.type = "text";
    title.maxLength = 40;
    title.value = item.title;
    title.placeholder = t("fields.shortcutTitle");
    title.setAttribute("aria-label", t("fields.shortcutTitle"));
    title.addEventListener("input", () => {
      const current = state.settings.shortcuts.items.find((entry) => entry.id === item.id);
      if (!current) return;
      current.title = title.value.slice(0, 40);
      scheduleSave();
    });
    const url = document.createElement("input");
    url.type = "url";
    url.value = item.url;
    url.placeholder = "https://";
    url.setAttribute("aria-label", t("fields.shortcutUrl"));
    url.addEventListener("change", () => {
      const current = state.settings.shortcuts.items.find((entry) => entry.id === item.id);
      if (!current) return;
      current.url = safeHttpUrl(url.value) || "";
      url.value = current.url;
      scheduleSave();
    });
    fields.append(title, url);
    const iconRow = document.createElement("div");
    iconRow.className = "inline";
    const iconType = document.createElement("select");
    for (const [value, key] of [["letter", "fields.iconLetter"], ["emoji", "fields.iconEmoji"], ["image", "fields.iconImage"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = t(key);
      iconType.append(option);
    }
    iconType.value = item.iconType;
    iconType.addEventListener("change", () => {
      item.iconType = iconType.value;
      scheduleSave();
      renderShortcuts();
    });
    const color = document.createElement("input");
    color.type = "color";
    color.value = /^#[0-9a-fA-F]{6}$/.test(item.color) ? item.color : "#e11d2e";
    color.addEventListener("input", () => {
      item.color = color.value;
      scheduleSave();
    });
    iconRow.append(iconType, color);
    if (item.iconType === "emoji") {
      const emoji = document.createElement("input");
      emoji.type = "text";
      emoji.maxLength = 8;
      emoji.value = item.emoji;
      emoji.placeholder = "★";
      emoji.addEventListener("input", () => {
        item.emoji = emoji.value.slice(0, 8);
        scheduleSave();
      });
      iconRow.append(emoji);
    }
    if (item.iconType === "image") {
      const file = document.createElement("input");
      file.type = "file";
      file.accept = "image/*";
      file.addEventListener("change", async () => {
        const picked = file.files?.[0];
        if (!picked || !picked.type.startsWith("image/") || picked.size > 8 * 1024 * 1024) {
          setStatus("fields.logoReject");
          return;
        }
        const id = item.iconId || `shortcut-${item.id}`;
        item.iconId = id;
        await putMedia(id, picked, { name: picked.name });
        scheduleSave();
      });
      iconRow.append(file);
    }
    const actions = document.createElement("div");
    actions.className = "mini";
    const up = document.createElement("button");
    up.type = "button";
    up.className = "btn";
    up.textContent = "↑";
    up.disabled = index === 0;
    up.addEventListener("click", () => moveShortcut(index, -1));
    const down = document.createElement("button");
    down.type = "button";
    down.className = "btn";
    down.textContent = "↓";
    down.disabled = index === state.settings.shortcuts.items.length - 1;
    down.addEventListener("click", () => moveShortcut(index, 1));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn";
    remove.textContent = t("fields.remove");
    remove.addEventListener("click", async () => {
      if (item.iconId) await deleteMedia(item.iconId).catch(() => {});
      state.settings.shortcuts.items.splice(index, 1);
      renderShortcuts();
      scheduleSave();
    });
    actions.append(up, down, remove);
    card.append(fields, iconRow, actions);
    list.append(card);
  });
}

function moveShortcut(index, delta) {
  const items = state.settings.shortcuts.items;
  const next = index + delta;
  if (next < 0 || next >= items.length) return;
  [items[index], items[next]] = [items[next], items[index]];
  renderShortcuts();
  scheduleSave();
}

function renderUrls() {
  const list = document.getElementById("url-list");
  list.replaceChildren();
  state.settings.pinnedTabs.startupUrls.forEach((url, index) => {
    const row = document.createElement("div");
    row.className = "url-row";
    const input = document.createElement("input");
    input.type = "url";
    input.value = url;
    input.addEventListener("change", () => {
      const safe = safeHttpUrl(input.value);
      if (!safe) {
        input.value = url;
        return;
      }
      state.settings.pinnedTabs.startupUrls[index] = safe;
      scheduleSave();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn";
    remove.textContent = t("fields.remove");
    remove.addEventListener("click", () => {
      state.settings.pinnedTabs.startupUrls.splice(index, 1);
      renderUrls();
      scheduleSave();
    });
    row.append(input, remove);
    list.append(row);
  });
}

function sendPreview() {
  if (!previewReady || !preview.contentWindow) return;
  preview.contentWindow.postMessage({ source: "tinparatan-options", settings: state.settings }, location.origin);
}

function scheduleSave() {
  writePaint(state.settings);
  applyThemeVars(state.settings);
  sendPreview();
  updateConditional();
  refreshVals();
  setStatus("options.saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const clean = await saveSettings(state.settings);
      const editing = document.activeElement?.matches?.("input, textarea, select");
      if (!editing) state.settings = clean;
      writePaint(state.settings);
      setStatus("options.saved");
    } catch (error) {
      console.error(error);
      setStatus("options.saveError");
    }
  }, 220);
}

function onControl(el) {
  if (!el?.dataset.bind) return;
  if (el.type === "radio" && !el.checked) return;
  const value = readControl(el);
  if (value === undefined) return;
  setPath(state.settings, el.dataset.bind, value);
  if (el.dataset.visual === "1") state.settings.theme.presetId = "custom";
  if (el.dataset.bind === "theme.background" && state.settings.background.type === "solid") {
    state.settings.background.color = state.settings.theme.background;
  }
  if (el.dataset.bind === "background.type" && value === "solid") {
    state.settings.background.color = state.settings.theme.background;
  }
  if (el.dataset.bind === "locale") paintCopy();
  highlightPreset();
  scheduleSave();
}

async function storeFile(id, file, { kinds, max = 80 * 1024 * 1024 }) {
  if (!file || file.size > max) {
    setStatus("fields.mediaReject");
    return false;
  }
  const type = file.type || (/\.svg$/i.test(file.name) ? "image/svg+xml" : "");
  const ok = kinds === "image" ? type.startsWith("image/") : /^(video\/mp4|video\/webm|video\/ogg)$/.test(type);
  if (!ok) {
    setStatus("fields.mediaReject");
    return false;
  }
  if (file.size > 25 * 1024 * 1024) setStatus("fields.logoBig");
  const blob = type === file.type ? file : new Blob([await file.arrayBuffer()], { type });
  await putMedia(id, blob, { name: file.name, type });
  return true;
}

function fitPreview() {
  const scale = previewScale.clientWidth / 1280;
  preview.style.transform = `scale(${scale})`;
  previewScale.style.height = `${800 * scale}px`;
}

function ask(title, body, okLabel) {
  document.getElementById("confirm-title").textContent = title;
  document.getElementById("confirm-body").textContent = body;
  document.getElementById("confirm-ok").textContent = okLabel;
  const dialog = document.getElementById("confirm");
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "ok"), { once: true });
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(data, type) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: type || "application/octet-stream" });
}

function bind() {
  document.body.addEventListener("input", (event) => onControl(event.target.closest("[data-bind]")));
  document.body.addEventListener("change", (event) => onControl(event.target.closest("[data-bind]")));
  document.querySelectorAll(".nav button").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById(button.dataset.goto)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  const sections = [...document.querySelectorAll(".section")];
  const navButtons = [...document.querySelectorAll(".nav button")];
  const spy = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    for (const button of navButtons) {
      button.setAttribute("aria-current", button.dataset.goto === visible.target.id ? "true" : "false");
    }
  }, { rootMargin: "-20% 0px -60% 0px", threshold: [0.15, 0.4] });
  sections.forEach((section) => spy.observe(section));

  document.getElementById("save-preset").addEventListener("click", () => {
    const name = document.getElementById("preset-name").value.trim();
    if (!name) {
      setStatus("presets.needName");
      return;
    }
    const preset = snapshotVisual(state.settings, name);
    state.settings.userPresets = [...state.settings.userPresets, preset].slice(-24);
    state.settings.theme.presetId = preset.id;
    document.getElementById("preset-name").value = "";
    renderUserPresets();
    highlightPreset();
    scheduleSave();
  });

  document.getElementById("logo-file").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const ok = await storeFile("logo-custom", file, { kinds: "image" });
    if (!ok) return;
    state.settings.logo.mode = "custom";
    state.settings.theme.presetId = "custom";
    fill();
    scheduleSave();
  });
  document.getElementById("logo-remove").addEventListener("click", async () => {
    await deleteMedia("logo-custom").catch(() => {});
    state.settings.logo.mode = "default";
    fill();
    scheduleSave();
  });
  document.getElementById("bg-image-file").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (await storeFile("bg-image", file, { kinds: "image" })) scheduleSave();
  });
  document.getElementById("bg-image-remove").addEventListener("click", async () => {
    await deleteMedia("bg-image").catch(() => {});
    scheduleSave();
  });
  document.getElementById("bg-video-file").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (await storeFile("bg-video", file, { kinds: "video" })) scheduleSave();
  });
  document.getElementById("bg-video-remove").addEventListener("click", async () => {
    await deleteMedia("bg-video").catch(() => {});
    scheduleSave();
  });
  document.getElementById("add-shortcut").addEventListener("click", () => {
    state.settings.shortcuts.items.push({
      id: uid("sc"),
      title: "",
      url: "",
      iconType: "letter",
      emoji: "",
      iconId: "",
      color: state.settings.theme.accent,
    });
    state.settings.shortcuts.enabled = true;
    renderShortcuts();
    scheduleSave();
    document.getElementById("shortcut-list").querySelector("input")?.focus();
  });
  document.getElementById("add-url").addEventListener("click", () => {
    const draft = document.getElementById("url-draft");
    const safe = safeHttpUrl(draft.value);
    if (!safe) {
      draft.setAttribute("aria-invalid", "true");
      return;
    }
    draft.removeAttribute("aria-invalid");
    if (!state.settings.pinnedTabs.startupUrls.includes(safe)) state.settings.pinnedTabs.startupUrls.push(safe);
    draft.value = "";
    renderUrls();
    scheduleSave();
  });
  document.getElementById("reload-now").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "tinp-reload-pinned", force: true }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) setStatus("popup.reloadFailed");
      else statusEl.textContent = response.count ? t("popup.reloaded", { count: response.count }) : t("popup.nonePinned");
    });
  });
  document.getElementById("export-btn").addEventListener("click", exportBackup);
  document.getElementById("import-file").addEventListener("change", importBackup);
  document.getElementById("reset-btn").addEventListener("click", resetAll);
  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin) return;
    if (event.data?.source === "tinparatan-ntp" && event.data.ready) {
      previewReady = true;
      sendPreview();
    }
  });
  preview.addEventListener("load", () => {
    previewReady = true;
    sendPreview();
  });
  new ResizeObserver(fitPreview).observe(previewScale);
}

async function exportBackup() {
  const records = await listMedia();
  const total = records.reduce((sum, record) => sum + (record.blob?.size || 0), 0);
  if (total > 30 * 1024 * 1024) {
    const ok = await ask(t("fields.export"), t("fields.exportBig"), t("fields.export"));
    if (!ok) return;
  }
  const media = [];
  for (const record of records) {
    media.push({
      id: record.id,
      type: record.type,
      name: record.name,
      data: await blobToBase64(record.blob),
    });
  }
  const backup = buildBackup({
    settings: state.settings,
    notes: await loadNotes(),
    todos: await loadTodos(),
    media,
  });
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tinparatan-ajustes.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    const parsed = parseBackup(await file.text());
    await clearMedia();
    for (const item of parsed.media) {
      await putMedia(item.id, base64ToBlob(item.data, item.type), { name: item.name || "" });
    }
    state.settings = normalizeSettings(parsed.settings);
    await saveBackupParts({ settings: state.settings, notes: parsed.notes, todos: parsed.todos });
    writePaint(state.settings);
    fill();
    sendPreview();
    setStatus("fields.importOk");
  } catch (error) {
    console.error(error);
    setStatus("fields.importBad");
  }
}

async function resetAll() {
  const ok = await ask(t("fields.resetTitle"), t("fields.resetBody"), t("fields.confirmReset"));
  if (!ok) return;
  await resetStorage();
  await clearMedia();
  clearPaint();
  state.settings = normalizeSettings(null);
  writePaint(state.settings);
  await saveSettings(state.settings);
  fill();
  sendPreview();
  setStatus("options.saved");
}

async function init() {
  bind();
  fillPositionSelects();
  try {
    state.settings = await loadSettings();
  } catch (error) {
    console.error(error);
  }
  setLocale(state.settings.locale);
  fill();
  fitPreview();
  preview.src = "../newtab/newtab.html?preview=1";
}

init();
