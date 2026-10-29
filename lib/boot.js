(function () {
  var root = document.documentElement;
  if (location.search.indexOf("preview=1") !== -1) root.classList.add("is-preview");
  var typing = true;
  try {
    var raw = localStorage.getItem("tinp-paint");
    if (!raw) {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) typing = false;
      if (typing) root.classList.add("will-type");
      return;
    }
    var paint = JSON.parse(raw);
    if (!paint || typeof paint !== "object") return;
    var map = {
      bg: "--bg",
      text: "--text",
      accent: "--accent",
      muted: "--muted",
      surface: "--surface",
      prompt: "--prompt",
      wordmark: "--wordmark",
      searchBg: "--search-bg",
      searchText: "--search-text",
      placeholder: "--placeholder",
      line: "--line",
    };
    Object.keys(map).forEach(function (key) {
      if (typeof paint[key] === "string" && paint[key].length > 0 && paint[key].length < 48) {
        root.style.setProperty(map[key], paint[key]);
      }
    });
    if (typeof paint.vignette === "number") root.style.setProperty("--vignette", String(paint.vignette));
    if (paint.motion === "on" || paint.motion === "off" || paint.motion === "system") {
      root.dataset.motion = paint.motion;
    }
    if (paint.scheme === "light" || paint.scheme === "dark") {
      root.dataset.scheme = paint.scheme;
      root.style.colorScheme = paint.scheme;
    }
    var backgrounds = { solid: 1, gradient: 1, image: 1, video: 1, effect: 1 };
    if (backgrounds[paint.bgType]) root.dataset.bg = paint.bgType;
    if (paint.motion === "off" || paint.typing === false) typing = false;
    if (paint.motion !== "on" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      typing = false;
    }
  } catch (error) {
    typing = true;
  }
  if (typing) root.classList.add("will-type");
})();
