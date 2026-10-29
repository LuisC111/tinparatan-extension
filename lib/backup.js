export function parseBackup(input) {
  const data = typeof input === "string" ? JSON.parse(input) : input;
  if (!data || typeof data !== "object" || data.type !== "tinparatan-backup") {
    throw new Error("invalid-backup");
  }
  if (!data.settings || typeof data.settings !== "object" || Array.isArray(data.settings)) {
    throw new Error("invalid-backup");
  }
  const media = Array.isArray(data.media) ? data.media : [];
  return {
    settings: data.settings,
    notes: typeof data.notes === "string" ? data.notes : "",
    todos: Array.isArray(data.todos) ? data.todos : [],
    media: media.filter((item) => item && typeof item.id === "string" && typeof item.data === "string"),
  };
}

export function buildBackup({ settings, notes, todos, media }) {
  return {
    type: "tinparatan-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    notes: notes || "",
    todos: todos || [],
    media: media || [],
  };
}
