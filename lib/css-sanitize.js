const REMOTE_URL = /url\s*\(\s*(['"]?)\s*(?:https?:)?\/\/[^)]*\)/gi;
const IMPORT_RULE = /@import\b[^;]*;?/gi;
const EXPRESSION = /expression\s*\([^)]*\)/gi;
const JS_URL = /url\s*\(\s*(['"]?)\s*javascript:[^)]*\)/gi;
const BEHAVIOR = /behaviou?r\s*:[^;}]*/gi;
const MOZ_BINDING = /-moz-binding\s*:[^;}]*/gi;

export function sanitizeCss(css) {
  if (typeof css !== "string") return "";
  return css
    .slice(0, 20000)
    .replace(IMPORT_RULE, "/* import removed */")
    .replace(EXPRESSION, "/* removed */")
    .replace(JS_URL, "/* removed */")
    .replace(REMOTE_URL, "/* remote url removed */")
    .replace(BEHAVIOR, "/* removed */")
    .replace(MOZ_BINDING, "/* removed */");
}
