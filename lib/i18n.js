import { en } from "./locales/en.js";
import { es } from "./locales/es.js";

const catalogs = { es, en };
let current = "es";

function lookup(dict, key) {
  return String(key)
    .split(".")
    .reduce((node, part) => (node && typeof node === "object" ? node[part] : undefined), dict);
}

export function setLocale(locale) {
  current = catalogs[locale] ? locale : "es";
  return current;
}

export function getLocale() {
  return current;
}

export function t(key, vars) {
  const value = lookup(catalogs[current], key) ?? lookup(catalogs.es, key) ?? key;
  if (typeof value !== "string") return key;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, name) => (vars[name] == null ? "" : String(vars[name])));
}

export function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
  });
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  if (root === document || root === document.documentElement) {
    document.documentElement.lang = current;
  }
}
