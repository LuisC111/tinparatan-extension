import { motionAllowed } from "../lib/motion.js";

const GLYPHS = "01<>[]{}*+-=#$TINPARATANXYZ";

export function createEffects(canvas) {
  let api = null;
  let running = false;
  let frameId = 0;
  let mode = "none";

  function loop(time) {
    if (!running || !api) return;
    api.frame(time);
    frameId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frameId);
    api?.destroy();
    api = null;
    mode = "none";
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  return {
    sync(settings) {
      const want =
        settings.background.type === "effect" &&
        settings.background.effect !== "aurora" &&
        motionAllowed(settings);
      const next = want ? settings.background.effect : "none";
      if (next === "none") {
        stop();
        canvas.hidden = true;
        return;
      }
      canvas.hidden = false;
      if (next !== mode) {
        stop();
        mode = next;
        api = build(next, canvas, settings);
        running = true;
        frameId = requestAnimationFrame(loop);
      } else {
        api?.update(settings);
      }
    },
    pause() {
      running = false;
      cancelAnimationFrame(frameId);
    },
    resume() {
      if (!api || running || document.hidden) return;
      running = true;
      frameId = requestAnimationFrame(loop);
    },
    resize() {
      api?.resize();
    },
    stop,
  };
}

function build(mode, canvas, settings) {
  if (mode === "matrix") return matrix(canvas, settings);
  if (mode === "embers") return sparks(canvas, settings, "embers");
  if (mode === "particles") return sparks(canvas, settings, "particles");
  return stars(canvas, settings);
}

function surface(canvas) {
  const ctx = canvas.getContext("2d", { alpha: true });
  const state = { width: 0, height: 0, dpr: 1 };
  function resize() {
    state.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    state.width = Math.max(1, canvas.clientWidth || window.innerWidth);
    state.height = Math.max(1, canvas.clientHeight || window.innerHeight);
    const nextWidth = Math.floor(state.width * state.dpr);
    const nextHeight = Math.floor(state.height * state.dpr);
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }
  resize();
  return { ctx, state, resize };
}

function stars(canvas, initial) {
  const view = surface(canvas);
  let settings = initial;
  let field = [];

  function seed() {
    const count = Math.round(70 + settings.background.intensity * 150);
    field = Array.from({ length: count }, () => ({
      x: Math.random() * view.state.width,
      y: Math.random() * view.state.height,
      z: Math.random(),
      r: Math.random() * 1.25 + 0.25,
      phase: Math.random() * Math.PI * 2,
      tint: Math.random() > 0.88,
    }));
  }
  seed();

  function frame(time) {
    const { ctx, state } = view;
    ctx.clearRect(0, 0, state.width, state.height);
    const accent = settings.theme.accent;
    for (const star of field) {
      const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time / 700 + star.phase));
      const y = (star.y + time * (0.004 + star.z * 0.012)) % state.height;
      ctx.globalAlpha = (0.28 + star.z * 0.72) * twinkle;
      ctx.fillStyle = star.tint ? accent : "#eef3ff";
      ctx.beginPath();
      ctx.arc(star.x, y, star.r * (0.55 + star.z), 0, Math.PI * 2);
      ctx.fill();
    }
    if (settings.background.intensity > 0.62) {
      ctx.lineWidth = 1;
      for (let i = 0; i < field.length; i += 1) {
        const a = field[i];
        const ay = (a.y + time * (0.004 + a.z * 0.012)) % state.height;
        for (let j = i + 1; j < Math.min(field.length, i + 7); j += 1) {
          const b = field[j];
          const by = (b.y + time * (0.004 + b.z * 0.012)) % state.height;
          const dx = a.x - b.x;
          const dy = ay - by;
          const dist = Math.hypot(dx, dy);
          if (dist < 110) {
            ctx.globalAlpha = (1 - dist / 110) * 0.22;
            ctx.strokeStyle = "#d5def0";
            ctx.beginPath();
            ctx.moveTo(a.x, ay);
            ctx.lineTo(b.x, by);
            ctx.stroke();
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  return {
    frame,
    update(next) { settings = next; },
    resize() { view.resize(); seed(); },
    destroy() { view.ctx.clearRect(0, 0, view.state.width, view.state.height); },
  };
}

function sparks(canvas, initial, kind) {
  const view = surface(canvas);
  let settings = initial;
  let parts = [];

  function make(randomLife) {
    const ember = kind === "embers";
    return {
      x: Math.random() * view.state.width,
      y: randomLife ? Math.random() * view.state.height : view.state.height + Math.random() * 40,
      r: ember ? 1 + Math.random() * 2.2 : 0.6 + Math.random() * 1.6,
      v: ember ? 0.35 + Math.random() * 0.9 : 0.08 + Math.random() * 0.22,
      drift: (Math.random() - 0.5) * (ember ? 0.45 : 0.25),
      life: randomLife ? Math.random() : 0,
      hue: Math.random(),
    };
  }

  function seed() {
    const count = Math.round((kind === "embers" ? 40 : 36) + settings.background.intensity * (kind === "embers" ? 70 : 50));
    parts = Array.from({ length: count }, () => make(true));
  }
  seed();

  function frame(time) {
    const { ctx, state } = view;
    ctx.clearRect(0, 0, state.width, state.height);
    const accent = settings.theme.accent;
    for (const part of parts) {
      part.life += kind === "embers" ? 0.0045 : 0.0015;
      part.y -= part.v * (0.6 + settings.background.intensity);
      part.x += part.drift + Math.sin(time / 900 + part.hue * 8) * 0.15;
      if (part.life > 1 || part.y < -20) Object.assign(part, make(false), { life: 0, y: state.height + 8 });
      const alpha = kind === "embers" ? Math.sin(part.life * Math.PI) : 0.25 + part.hue * 0.45;
      ctx.fillStyle = kind === "embers" ? (part.hue > 0.55 ? "#ffb067" : accent) : accent;
      ctx.globalAlpha = alpha * 0.18;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.r * 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return {
    frame,
    update(next) { settings = next; },
    resize() { view.resize(); seed(); },
    destroy() { view.ctx.clearRect(0, 0, view.state.width, view.state.height); },
  };
}

function matrix(canvas, initial) {
  const view = surface(canvas);
  let settings = initial;
  const fontSize = 16;
  let drops = [];

  function seed() {
    const cols = Math.ceil(view.state.width / fontSize);
    drops = Array.from({ length: cols }, () => Math.random() * (view.state.height / fontSize));
  }
  seed();

  function frame() {
    const { ctx, state } = view;
    ctx.fillStyle = "rgba(1, 10, 7, 0.12)";
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.font = `500 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
    const accent = settings.theme.accent || "#3dff8a";
    for (let i = 0; i < drops.length; i += 1) {
      const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      const x = i * fontSize;
      const y = drops[i] * fontSize;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#f3fff8";
      ctx.fillText(glyph, x, y);
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = accent;
      ctx.fillText(GLYPHS[Math.floor(Math.random() * GLYPHS.length)], x, y - fontSize);
      if (y > state.height && Math.random() > 0.965) drops[i] = 0;
      drops[i] += 0.45 + settings.background.intensity * 0.35;
    }
    ctx.globalAlpha = 1;
  }

  return {
    frame,
    update(next) { settings = next; },
    resize() { view.resize(); seed(); },
    destroy() { view.ctx.clearRect(0, 0, view.state.width, view.state.height); },
  };
}
