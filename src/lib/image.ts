import sharp, { type OutputInfo } from "sharp";
import {
  clampQuality,
  FORMAT_EXT,
  FORMAT_MIME,
  type OutputFormat,
} from "@/lib/format";

export type ProcessOptions = {
  format: OutputFormat;
  quality: number;
  maxWidth?: number;
  maxSizeKB?: number;
};

export type ProcessResult = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  width: number;
  height: number;
  size: number;
  originalWidth: number;
  originalHeight: number;
  originalSize: number;
  withinLimit: boolean;
};

const MIN_WIDTH = 64;

async function encodeAt(
  input: Buffer,
  format: OutputFormat,
  quality: number,
  width?: number,
): Promise<{ data: Buffer; info: OutputInfo }> {
  let pipeline = sharp(input, { failOn: "none" }).rotate();

  if (width && width > 0) {
    pipeline = pipeline.resize({
      width: Math.round(width),
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const q = clampQuality(quality);

  switch (format) {
    case "jpeg":
      pipeline = pipeline.jpeg({ quality: q, mozjpeg: true });
      break;
    case "png":
      pipeline = pipeline.png({
        compressionLevel: 9,
        effort: 10,
        adaptiveFiltering: true,
        palette: q <= 70,
        quality: q <= 70 ? Math.max(40, q) : undefined,
      });
      break;
    case "webp":
      pipeline = pipeline.webp({ quality: q });
      break;
    case "avif":
      pipeline = pipeline.avif({ quality: q });
      break;
  }

  return pipeline.toBuffer({ resolveWithObject: true });
}

export async function processImage(
  input: Buffer,
  options: ProcessOptions,
): Promise<ProcessResult> {
  const meta = await sharp(input, { failOn: "none" }).rotate().metadata();
  const originalWidth = meta.width ?? 0;
  const originalHeight = meta.height ?? 0;

  const maxBytes =
    options.maxSizeKB && options.maxSizeKB > 0
      ? Math.round(options.maxSizeKB * 1024)
      : undefined;

  let width =
    options.maxWidth && options.maxWidth > 0
      ? options.maxWidth
      : originalWidth > 0
        ? originalWidth
        : 2048;

  if (originalWidth > 0) width = Math.min(width, originalWidth);

  const quality = clampQuality(options.quality);
  let { data, info } = await encodeAt(input, options.format, quality, width);

  if (maxBytes && data.length > maxBytes) {
    let low = 1;
    let high = quality;
    let best = { data, info };

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const attempt = await encodeAt(input, options.format, mid, width);
      if (attempt.data.length <= maxBytes) {
        best = attempt;
        low = mid + 1;
      } else {
        if (attempt.data.length < best.data.length) best = attempt;
        high = mid - 1;
      }
    }

    data = best.data;
    info = best.info;

    let guard = 0;
    while (data.length > maxBytes && width > MIN_WIDTH && guard < 40) {
      guard += 1;
      width = Math.max(MIN_WIDTH, Math.floor(width * 0.8));
      const attempt = await encodeAt(input, options.format, 1, width);
      data = attempt.data;
      info = attempt.info;
    }
  }

  return {
    buffer: data,
    mimeType: FORMAT_MIME[options.format],
    extension: FORMAT_EXT[options.format],
    width: info.width,
    height: info.height,
    size: data.length,
    originalWidth,
    originalHeight,
    originalSize: input.length,
    withinLimit: maxBytes ? data.length <= maxBytes : true,
  };
}
