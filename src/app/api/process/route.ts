import { NextRequest, NextResponse } from "next/server";
import { type OutputFormat } from "@/lib/format";
import { processImage } from "@/lib/image";

export const runtime = "nodejs";

const FORMATS = new Set<OutputFormat>(["jpeg", "png", "webp", "avif"]);
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function parsePositiveInt(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Chưa chọn ảnh." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Chỉ nhận file ảnh." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Ảnh tối đa 25MB." }, { status: 400 });
    }

    const format = String(formData.get("format") || "webp") as OutputFormat;
    if (!FORMATS.has(format)) {
      return NextResponse.json({ error: "Format không hợp lệ." }, { status: 400 });
    }

    const result = await processImage(Buffer.from(await file.arrayBuffer()), {
      format,
      quality: Number.parseInt(String(formData.get("quality") || "80"), 10),
      maxWidth: parsePositiveInt(formData.get("maxWidth")),
      maxSizeKB: parsePositiveInt(formData.get("maxSizeKB")),
    });

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    const filename = `${baseName}.${result.extension}`;

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Original-Size": String(result.originalSize),
        "X-Output-Size": String(result.size),
        "X-Original-Width": String(result.originalWidth),
        "X-Original-Height": String(result.originalHeight),
        "X-Output-Width": String(result.width),
        "X-Output-Height": String(result.height),
        "X-Filename": filename,
        "X-Within-Limit": result.withinLimit ? "1" : "0",
      },
    });
  } catch (error) {
    console.error("[/api/process]", error);
    const message = error instanceof Error ? error.message : "Xử lý ảnh thất bại.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
