// Time-of-day greeting: phases, phrases and the gradient each phase paints.

/** Phases in minutes since local midnight, [from, to). Cover 0..1440 with no gaps. */
export const GREETING_PHASES = [
  { id: "madrugada", from: 0, to: 5 * 60 },
  { id: "amanecer", from: 5 * 60, to: 7 * 60 },
  { id: "manana", from: 7 * 60, to: 12 * 60 },
  { id: "mediodia", from: 12 * 60, to: 14 * 60 },
  { id: "tarde", from: 14 * 60, to: 18 * 60 },
  { id: "atardecer", from: 18 * 60, to: 19 * 60 + 30 },
  { id: "noche", from: 19 * 60 + 30, to: 24 * 60 },
];

export const GREETING_PHASE_IDS = GREETING_PHASES.map((phase) => phase.id);

/** Three stops per phase, tuned to stay legible on the dark new tab. */
export const GREETING_GRADIENTS = {
  madrugada: ["#6d5dfc", "#a78bfa", "#4f46e5"],
  amanecer: ["#ff8fb8", "#ffb48a", "#ffd56b"],
  manana: ["#ffcf5a", "#fff0b8", "#7cc8ff"],
  mediodia: ["#ffe94d", "#fffbd1", "#3ce0ff"],
  tarde: ["#ff9a1f", "#ffc23d", "#ffdf8a"],
  atardecer: ["#ff4fa3", "#ff7a3d", "#ff3b3b"],
  noche: ["#5b7cff", "#a06bff", "#2dd4bf"],
};

/** Phase id for a Date or a minute-of-day number. */
export function greetingPhase(when = new Date()) {
  let minutes = typeof when === "number" ? when : when.getHours() * 60 + when.getMinutes();
  minutes = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  return (GREETING_PHASES.find((phase) => minutes >= phase.from && minutes < phase.to) || GREETING_PHASES[0]).id;
}

/** i18n key for a phase's phrase (greeting.<phase>). */
export function greetingKey(phase) {
  return `greeting.${GREETING_PHASE_IDS.includes(phase) ? phase : "noche"}`;
}

/** "Buenas noches" + name -> "Buenas noches,". A custom text ending in punctuation keeps it. */
export function greetingPrefix(text, hasName) {
  const clean = String(text || "").trim();
  if (!clean || !hasName || /[,.;:!?¡¿…~\-–—]$/.test(clean)) return clean;
  return `${clean},`;
}

/** Milliseconds until the next minute boundary (re-evaluate the phase then). */
export function msToNextMinute(date = new Date()) {
  return 60000 - (date.getSeconds() * 1000 + date.getMilliseconds()) + 50;
}
