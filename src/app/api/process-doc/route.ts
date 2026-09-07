import { NextRequest, NextResponse } from "next/server";
import {
  DOC_FORMATS,
  MAX_DOC_BYTES,
  detectDocKind,
  allowedOutputs,
  type DocOutputFormat,
} from "@/lib/doc-format";
import { fileToBuffer, processDoc } from "@/lib/doc";

export const runtime = "nodejs";
export const maxDuration = 120;

const FORMAT_IDS = new Set(DOC_FORMATS.map((f) => f.id));

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Chưa chọn file." }, { status: 400 });
    }

    const kind = detectDocKind(file);
    if (!kind) {
      return NextResponse.json(
        { error: "Chỉ nhận PDF, Excel, CSV, HTML, DOCX, TXT, Markdown." },
        { status: 400 },
      );
    }
    if (file.size > MAX_DOC_BYTES) {
      return NextResponse.json({ error: "File tối đa 50MB." }, { status: 400 });
    }

    const format = String(formData.get("format") || "pdf") as DocOutputFormat;
    if (!FORMAT_IDS.has(format)) {
      return NextResponse.json({ error: "Format không hợp lệ." }, { status: 400 });
    }
    if (!allowedOutputs(kind).includes(format)) {
      return NextResponse.json(
        { error: `Không convert ${kind.toUpperCase()} → ${format.toUpperCase()}.` },
        { status: 400 },
      );
    }

    const title = file.name.replace(/\.[^.]+$/i, "").trim() || "document";
    const input = await fileToBuffer(file);
    const result = await processDoc(input, { kind, format, title });
    const filename = `${title}.${result.extension}`;

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]+/g, "_")}"`,
        "Content-Length": String(result.size),
        "X-Original-Size": String(result.originalSize),
        "X-Output-Size": String(result.size),
        "X-Filename": encodeURIComponent(filename),
        "X-Extension": result.extension,
        "X-Summary": encodeURIComponent(result.summary),
      },
    });
  } catch (error) {
    console.error("[/api/process-doc]", error);
    const message = error instanceof Error ? error.message : "Convert thất bại.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
