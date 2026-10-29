import { normalizeNotes, normalizeSettings, normalizeTodos } from "./normalize.js";

const SETTINGS_KEY = "settings";
const NOTES_KEY = "notes";
const TODOS_KEY = "todos";

export async function loadSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(data[SETTINGS_KEY]);
}

export async function saveSettings(settings) {
  const clean = normalizeSettings(settings);
  await chrome.storage.local.set({ [SETTINGS_KEY]: clean });
  return clean;
}

export async function loadNotes() {
  const data = await chrome.storage.local.get(NOTES_KEY);
  return normalizeNotes(data[NOTES_KEY]);
}

export async function saveNotes(text) {
  const notes = normalizeNotes(text);
  await chrome.storage.local.set({ [NOTES_KEY]: notes });
  return notes;
}

export async function loadTodos() {
  const data = await chrome.storage.local.get(TODOS_KEY);
  return normalizeTodos(data[TODOS_KEY]);
}

export async function saveTodos(items) {
  const todos = normalizeTodos(items);
  await chrome.storage.local.set({ [TODOS_KEY]: todos });
  return todos;
}

export async function saveBackupParts({ settings, notes, todos }) {
  const clean = normalizeSettings(settings);
  const payload = { [SETTINGS_KEY]: clean };
  if (notes !== undefined) payload[NOTES_KEY] = normalizeNotes(notes);
  if (todos !== undefined) payload[TODOS_KEY] = normalizeTodos(todos);
  await chrome.storage.local.set(payload);
  return clean;
}

export async function resetStorage() {
  await chrome.storage.local.remove([SETTINGS_KEY, NOTES_KEY, TODOS_KEY]);
}
