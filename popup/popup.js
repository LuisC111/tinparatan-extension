import { applyI18n, setLocale, t } from "../lib/i18n.js";
import { writePaint } from "../lib/paint.js";
import { PRESETS, applyVisualPreset, findPreset } from "../lib/presets.js";
import { loadSettings, saveSettings } from "../lib/storage.js";
import { applyThemeVars } from "../lib/theme.js";

const presetSelect = document.getElementById("preset");
const motion = document.getElementById("motion");
const reloadBtn = document.getElementById("reload");
const statusEl = document.getElementById("status");
let settings = null;

function fillPresets() {
  const current = presetSelect.value;
  presetSelect.replaceChildren();
  const custom = document.createElement("option");
  custom.value = "custom";
  custom.textContent = t("presets.custom");
  presetSelect.append(custom);
  for (const preset of PRESETS) {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = t(preset.nameKey);
    presetSelect.append(option);
  }
  for (const preset of settings.userPresets) {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.name;
    presetSelect.append(option);
  }
  const wanted = settings.theme.presetId;
  presetSelect.value = [...presetSelect.options].some((option) => option.value === wanted) ? wanted : current || "custom";
}

async function persist(next) {
  settings = await saveSettings(next);
  writePaint(settings);
  applyThemeVars(settings);
}

async function init() {
  settings = await loadSettings();
  setLocale(settings.locale);
  applyThemeVars(settings);
  applyI18n();
  fillPresets();
  motion.checked = settings.motion !== "off";
}

presetSelect.addEventListener("change", async () => {
  const preset = findPreset(settings, presetSelect.value);
  if (!preset) {
    settings.theme.presetId = "custom";
    await persist(settings);
    return;
  }
  settings = applyVisualPreset(settings, preset);
  await persist(settings);
});

motion.addEventListener("change", async () => {
  settings.motion = motion.checked ? "on" : "off";
  await persist(settings);
});

reloadBtn.addEventListener("click", () => {
  reloadBtn.disabled = true;
  statusEl.textContent = t("popup.reloading");
  chrome.runtime.sendMessage({ type: "tinp-reload-pinned", force: true }, (response) => {
    reloadBtn.disabled = false;
    if (chrome.runtime.lastError || !response?.ok) {
      statusEl.textContent = t("popup.reloadFailed");
      return;
    }
    statusEl.textContent = response.count ? t("popup.reloaded", { count: response.count }) : t("popup.nonePinned");
  });
});

document.getElementById("settings").addEventListener("click", () => chrome.runtime.openOptionsPage());

init().catch((error) => {
  console.error(error);
  statusEl.textContent = t("options.saveError");
});
