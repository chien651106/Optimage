import { randomUUID } from "crypto";
import { createReadStream, createWriteStream } from "fs";
import { stat, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { clampQuality } from "@/lib/format";
import {
  VIDEO_FORMAT_EXT,
  VIDEO_FORMAT_MIME,
  type VideoOutputFormat,
} from "@/lib/video-format";

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export type ProcessVideoOptions = {
  format: VideoOutputFormat;
  quality: number;
  maxWidth?: number;
};

export type ProcessVideoResult = {
  outputPath: string;
  mimeType: string;
  extension: string;
  size: number;
  originalSize: number;
  width: number;
  height: number;
  duration: number;
};

/** Map UI quality → CRF: 100 ≈ sharp + compact (x264 ~20 / vp9 ~28) */
function qualityToCrf(quality: number, codec: "x264" | "vp9"): number {
  const q = clampQuality(quality);
  if (codec === "vp9") {
    return Math.round(45 - ((q - 1) / 99) * 17);
  }
  return Math.round(40 - ((q - 1) / 99) * 20);
}

/** Keep even width/height for yuv420p; optionally cap width. */
function scaleFilter(maxWidth?: number): string {
  if (maxWidth && maxWidth > 0) {
    return `scale='min(${Math.round(maxWidth)},iw)':-2`;
  }
  // Even dims required by yuv420p; no-op for already-even frames
  return "scale=trunc(iw/2)*2:trunc(ih/2)*2";
}

function parseDuration(raw: string | undefined): number {
  if (!raw) return 0;
  const parts = raw.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function runFfmpeg(
  inputPath: string,
  outputPath: string,
  options: ProcessVideoOptions,
): Promise<{ duration: number }> {
  const q = clampQuality(options.quality);
  const scale = scaleFilter(options.maxWidth);

  return new Promise((resolve, reject) => {
    let duration = 0;
    const command = ffmpeg(inputPath)
      .inputOptions(["-err_detect", "ignore_err"])
      .output(outputPath);

    command.on("codecData", (data) => {
      duration = parseDuration(data.duration);
    });

    switch (options.format) {
      case "mp4": {
        const crf = qualityToCrf(q, "x264");
        command
          .videoFilters(scale)
          .videoCodec("libx264")
          .audioCodec("aac")
          .outputOptions([
            `-crf ${crf}`,
            // medium: ổn định hơn slow trên máy RAM thấp / file 1080p dài
            "-preset medium",
            "-movflags +faststart",
            "-pix_fmt yuv420p",
            "-b:a 96k",
          ]);
        break;
      }
      case "mov": {
        const crf = qualityToCrf(q, "x264");
        command
          .videoFilters(scale)
          .videoCodec("libx264")
          .audioCodec("aac")
          .format("mov")
          .outputOptions([
            `-crf ${crf}`,
            "-preset medium",
            "-pix_fmt yuv420p",
            "-b:a 96k",
          ]);
        break;
      }
      case "webm": {
        const crf = qualityToCrf(q, "vp9");
        command
          .videoFilters(scale)
          .videoCodec("libvpx-vp9")
          .audioCodec("libopus")
          .outputOptions([
            `-crf ${crf}`,
            "-b:v 0",
            "-row-mt 1",
            "-cpu-used 2",
            "-b:a 96k",
          ]);
        break;
      }
      case "gif": {
        const w =
          options.maxWidth && options.maxWidth > 0
            ? `'min(${Math.round(options.maxWidth)},iw)'`
            : "iw";
        command.noAudio().outputOptions([
          "-vf",
          `fps=12,scale=${w}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5`,
        ]);
        break;
      }
    }

    command
      .on("end", () => resolve({ duration }))
      .on("error", (err, _stdout, stderr) => {
        const lines =
          typeof stderr === "string"
            ? stderr
                .trim()
                .split(/\r?\n/)
                .filter(Boolean)
                .slice(-6)
                .join(" · ")
            : "";
        reject(new Error(lines || err.message || "FFmpeg conversion failed."));
      })
      .run();
  });
}

/** Stream a browser/Node File to disk without building one giant ArrayBuffer. */
export async function saveUploadToTemp(file: File, destPath: string): Promise<void> {
  const webStream = file.stream();
  await pipeline(
    Readable.fromWeb(webStream as import("stream/web").ReadableStream),
    createWriteStream(destPath),
  );
}

const INPUT_EXTS = new Set(["mp4", "webm", "mov", "mkv", "avi", "m4v", "gif"]);

export function createTempVideoPaths(format: VideoOutputFormat, sourceName?: string) {
  const id = randomUUID();
  const ext = VIDEO_FORMAT_EXT[format];
  const raw = sourceName?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  const inExt = raw && INPUT_EXTS.has(raw) ? raw : "mp4";
  return {
    id,
    ext,
    inputPath: join(tmpdir(), `pixora-in-${id}.${inExt}`),
    outputPath: join(tmpdir(), `pixora-out-${id}.${ext}`),
  };
}

export async function cleanupTempPaths(...paths: string[]) {
  await Promise.allSettled(paths.map((p) => unlink(p)));
}

/** Stream a file as a Web ReadableStream; delete paths when done or cancelled. */
export function streamFileAndCleanup(
  filePath: string,
  cleanupPaths: string[],
): ReadableStream<Uint8Array> {
  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    void cleanupTempPaths(...cleanupPaths);
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = webStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        cleanup();
      }
    },
    cancel() {
      nodeStream.destroy();
      void webStream.cancel().catch(() => undefined);
      cleanup();
    },
  });
}

export async function processVideoFile(
  inputPath: string,
  outputPath: string,
  originalSize: number,
  options: ProcessVideoOptions,
): Promise<ProcessVideoResult> {
  if (!ffmpegPath) {
    throw new Error("FFmpeg chưa được cài. Chạy lại npm install.");
  }

  const ext = VIDEO_FORMAT_EXT[options.format];
  const { duration } = await runFfmpeg(inputPath, outputPath, options);
  const outStat = await stat(outputPath);

  return {
    outputPath,
    mimeType: VIDEO_FORMAT_MIME[options.format],
    extension: ext,
    size: outStat.size,
    originalSize,
    width: options.maxWidth && options.maxWidth > 0 ? options.maxWidth : 0,
    height: 0,
    duration,
  };
}
