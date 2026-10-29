export const FONTS = [
  {
    id: "jetbrains-mono",
    family: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  {
    id: "ibm-plex-mono",
    family: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  {
    id: "space-grotesk",
    family: '"Space Grotesk", Inter, system-ui, sans-serif',
  },
  {
    id: "inter",
    family: "Inter, system-ui, sans-serif",
  },
  {
    id: "fraunces",
    family: "Fraunces, Georgia, 'Times New Roman', serif",
  },
  {
    id: "system-sans",
    family: "system-ui, sans-serif",
  },
  {
    id: "system-mono",
    family: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
];

export function fontFamily(id) {
  return FONTS.find((font) => font.id === id)?.family || FONTS[0].family;
}
