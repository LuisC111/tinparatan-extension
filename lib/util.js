export function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function getPath(obj, path) {
  return String(path)
    .split(".")
    .reduce((current, key) => (current == null ? current : current[key]), obj);
}

export function setPath(obj, path, value) {
  const keys = String(path).split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (current[key] == null || typeof current[key] !== "object") current[key] = {};
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

export function uid(prefix = "id") {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
}

export function deepMerge(base, extra) {
  if (!extra || typeof extra !== "object") return base;
  for (const key of Object.keys(extra)) {
    const value = extra[key];
    if (Array.isArray(value)) {
      base[key] = structuredClone(value);
    } else if (value && typeof value === "object") {
      if (!base[key] || typeof base[key] !== "object" || Array.isArray(base[key])) base[key] = {};
      deepMerge(base[key], value);
    } else if (value !== undefined) {
      base[key] = value;
    }
  }
  return base;
}
