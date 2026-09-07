import { NextRequest, NextResponse } from "next/server";
import { type VideoOutputFormat, MAX_VIDEO_BYTES } from "@/lib/video-format";
import {
  cleanupTempPaths,
  createTempVideoPaths,
  processVideoFile,
  saveUploadToTemp,
  streamFileAndCleanup,
} from "@/lib/video";

export const runtime = "nodejs";
/** Hobby max is 300s; 600+ fails deploy with a silent Error at "Deploying outputs". */
export const maxDuration = 300;

const FORMATS = new Set<VideoOutputFormat>(["mp4", "webm", "mov", "gif"]);

function parsePositiveInt(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function isVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  // Some browsers leave GIF uploads as image/* even when used as animation source
  const name = file.name.toLowerCase();
  return /\.(mp4|webm|mov|mkv|avi|m4v|gif)$/i.test(name);
}

export async function POST(request: NextRequest) {
  let inputPath: string | null = null;
  let outputPath: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("video");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Chưa chọn video." }, { status: 400 });
    }
    if (!isVideoFile(file)) {
      return NextResponse.json({ error: "Chỉ nhận file video." }, { status: 400 });
    }
    if (file.size > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: "Video tối đa 500MB." }, { status: 400 });
    }

    const format = String(formData.get("format") || "mp4") as VideoOutputFormat;
    if (!FORMATS.has(format)) {
      return NextResponse.json({ error: "Format không hợp lệ." }, { status: 400 });
    }

    const paths = createTempVideoPaths(format, file.name);
    inputPath = paths.inputPath;
    outputPath = paths.outputPath;

    await saveUploadToTemp(file, inputPath);

    const result = await processVideoFile(inputPath, outputPath, file.size, {
      format,
      quality: Number.parseInt(String(formData.get("quality") || "100"), 10),
      maxWidth: parsePositiveInt(formData.get("maxWidth")),
    });

    const baseName = file.name.replace(/\.[^.]+$/, "") || "video";
    const filename = `${baseName}.${result.extension}`;
    const cleanupPaths = [inputPath, outputPath];
    // Ownership of cleanup moves to the response stream
    inputPath = null;
    outputPath = null;

    return new NextResponse(streamFileAndCleanup(result.outputPath, cleanupPaths), {
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(result.size),
        "X-Original-Size": String(result.originalSize),
        "X-Output-Size": String(result.size),
        "X-Output-Width": String(result.width),
        "X-Output-Height": String(result.height),
        "X-Duration": String(result.duration),
        "X-Filename": filename,
      },
    });
  } catch (error) {
    if (inputPath || outputPath) {
      await cleanupTempPaths(...[inputPath, outputPath].filter(Boolean) as string[]);
    }
    console.error("[/api/process-video]", error);
    const message = error instanceof Error ? error.message : "Xử lý video thất bại.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
