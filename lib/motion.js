export function motionAllowed(settings, matchMediaFn) {
  if (!settings || settings.motion === "off") return false;
  if (settings.motion === "on") return true;
  const query = "(prefers-reduced-motion: reduce)";
  try {
    const media = matchMediaFn ? matchMediaFn(query) : globalThis.matchMedia?.(query);
    return !media?.matches;
  } catch {
    return true;
  }
}
