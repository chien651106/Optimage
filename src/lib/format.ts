export type OutputFormat = "jpeg" | "png" | "webp" | "avif";

export const FORMATS: { id: OutputFormat; label: string }[] = [
  { id: "webp", label: "WebP" },
  { id: "jpeg", label: "JPEG" },
  { id: "png", label: "PNG" },
  { id: "avif", label: "AVIF" },
];

export const FORMAT_EXT: Record<OutputFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  avif: "avif",
};

export const FORMAT_MIME: Record<OutputFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

export const MAX_FILES = 50;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function clampQuality(value: number): number {
  if (Number.isNaN(value)) return 80;
  return Math.min(100, Math.max(1, Math.round(value)));
}

export function uniqueFilename(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const base = dot >= 0 ? name.slice(0, dot) : name;
  const ext = dot >= 0 ? name.slice(dot) : "";
  let n = 2;
  while (used.has(`${base}-${n}${ext}`)) n += 1;
  const next = `${base}-${n}${ext}`;
  used.add(next);
  return next;
}
