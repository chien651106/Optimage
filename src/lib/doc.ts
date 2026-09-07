import { createWriteStream, existsSync } from "fs";
import { readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import PDFDocument from "pdfkit";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import {
  DOC_FORMAT_EXT,
  DOC_FORMAT_MIME,
  type DocInputKind,
  type DocOutputFormat,
} from "@/lib/doc-format";

export type ProcessDocResult = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  size: number;
  originalSize: number;
  summary: string;
};

/** Literal paths only — dynamic existsSync(var) makes Turbopack trace the whole repo. */
function resolveUnicodeFont(): string | null {
  if (existsSync("C:\\Windows\\Fonts\\arial.ttf")) return "C:\\Windows\\Fonts\\arial.ttf";
  if (existsSync("C:\\Windows\\Fonts\\segoeui.ttf")) return "C:\\Windows\\Fonts\\segoeui.ttf";
  if (existsSync("C:\\Windows\\Fonts\\tahoma.ttf")) return "C:\\Windows\\Fonts\\tahoma.ttf";
  if (existsSync("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")) {
    return "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
  }
  if (existsSync("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf")) {
    return "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf";
  }
  if (existsSync("/System/Library/Fonts/Supplemental/Arial Unicode.ttf")) {
    return "/System/Library/Fonts/Supplemental/Arial Unicode.ttf";
  }
  if (existsSync("/System/Library/Fonts/Supplemental/Arial.ttf")) {
    return "/System/Library/Fonts/Supplemental/Arial.ttf";
  }
  return null;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/(h[1-6]|div|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mdToHtml(md: string): string {
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const withCode = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
  const withBold = withCode.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const withItalic = withBold.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  const withHeadings = withItalic.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes: string, text: string) => {
    const level = Math.min(hashes.length, 6);
    return `<h${level}>${text}</h${level}>`;
  });
  const withBreaks = withHeadings.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br/>");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Document</title></head><body><p>${withBreaks}</p></body></html>`;
}

function wrapHtml(body: string, title = "Document"): string {
  if (/<html[\s>]/i.test(body)) return body;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title><style>body{font-family:system-ui,sans-serif;line-height:1.5;padding:24px;color:#10233a}table{border-collapse:collapse;width:100%}td,th{border:1px solid #c9d2de;padding:6px 8px;text-align:left}th{background:#eef2f7}</style></head><body>${body}</body></html>`;
}

function sheetToMatrix(wb: XLSX.WorkBook): string[][] {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  }) as string[][];
}

function matrixToHtml(rows: string[][], title: string): string {
  if (!rows.length) return wrapHtml("<p>(empty)</p>", title);
  const [head, ...rest] = rows;
  const thead = `<tr>${head.map((c) => `<th>${escapeHtml(String(c ?? ""))}</th>`).join("")}</tr>`;
  const tbody = rest
    .map(
      (row) =>
        `<tr>${head.map((_, i) => `<td>${escapeHtml(String(row[i] ?? ""))}</td>`).join("")}</tr>`,
    )
    .join("");
  return wrapHtml(`<h1>${escapeHtml(title)}</h1><table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`, title);
}

function matrixToText(rows: string[][]): string {
  return rows.map((row) => row.map((c) => String(c ?? "")).join("\t")).join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function textToPdf(text: string, title: string): Promise<Buffer> {
  const font = resolveUnicodeFont();
  const doc = new PDFDocument({ margin: 48, info: { Title: title } });
  if (font) {
    doc.registerFont("Body", font);
    doc.font("Body");
  } else {
    doc.font("Helvetica");
  }

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fontSize(16).text(title, { underline: true });
  doc.moveDown();
  doc.fontSize(11).text(text || "(empty)", { align: "left" });
  doc.end();
  return done;
}

async function parsePdfText(buffer: Buffer): Promise<string> {
  // pdf-parse exports a function; CJS interop under Next/Node
  const mod = await import("pdf-parse");
  const pdfParse = (mod as { default?: (b: Buffer) => Promise<{ text: string }> }).default ??
    (mod as unknown as (b: Buffer) => Promise<{ text: string }>);
  const data = await pdfParse(buffer);
  return (data.text || "").trim();
}

type NormalizedDoc = {
  kind: DocInputKind;
  title: string;
  text: string;
  html: string;
  workbook: XLSX.WorkBook | null;
  matrix: string[][] | null;
};

async function normalizeInput(
  buffer: Buffer,
  kind: DocInputKind,
  title: string,
): Promise<NormalizedDoc> {
  switch (kind) {
    case "xlsx": {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const matrix = sheetToMatrix(workbook);
      const text = matrixToText(matrix);
      return {
        kind,
        title,
        text,
        html: matrixToHtml(matrix, title),
        workbook,
        matrix,
      };
    }
    case "csv": {
      const workbook = XLSX.read(buffer, { type: "buffer", raw: false });
      const matrix = sheetToMatrix(workbook);
      return {
        kind,
        title,
        text: matrixToText(matrix),
        html: matrixToHtml(matrix, title),
        workbook,
        matrix,
      };
    }
    case "docx": {
      const result = await mammoth.convertToHtml({ buffer });
      const html = wrapHtml(result.value || "<p></p>", title);
      return {
        kind,
        title,
        text: stripTags(html),
        html,
        workbook: null,
        matrix: null,
      };
    }
    case "html": {
      const raw = buffer.toString("utf8");
      const html = wrapHtml(raw, title);
      return { kind, title, text: stripTags(html), html, workbook: null, matrix: null };
    }
    case "md": {
      const md = buffer.toString("utf8");
      const html = mdToHtml(md);
      return { kind, title, text: md, html, workbook: null, matrix: null };
    }
    case "txt": {
      const text = buffer.toString("utf8");
      return {
        kind,
        title,
        text,
        html: wrapHtml(`<pre>${escapeHtml(text)}</pre>`, title),
        workbook: null,
        matrix: null,
      };
    }
    case "pdf": {
      const text = await parsePdfText(buffer);
      return {
        kind,
        title,
        text,
        html: wrapHtml(`<pre>${escapeHtml(text)}</pre>`, title),
        workbook: null,
        matrix: null,
      };
    }
    default:
      throw new Error("Định dạng nguồn không hỗ trợ.");
  }
}

function ensureSheetWorkbook(doc: NormalizedDoc): XLSX.WorkBook {
  if (doc.workbook) return doc.workbook;
  if (doc.matrix) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(doc.matrix);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    return wb;
  }
  // Fallback: one-column text lines → sheet
  const rows = doc.text.split(/\r?\n/).map((line) => [line]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows.length ? rows : [[""]]);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return wb;
}

export async function processDoc(
  input: Buffer,
  options: { kind: DocInputKind; format: DocOutputFormat; title: string },
): Promise<ProcessDocResult> {
  const originalSize = input.length;
  const doc = await normalizeInput(input, options.kind, options.title);
  const ext = DOC_FORMAT_EXT[options.format];
  let buffer: Buffer;
  let summary = "";

  switch (options.format) {
    case "csv": {
      const wb = ensureSheetWorkbook(doc);
      buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "csv" }) as Buffer);
      summary = `CSV · ${doc.matrix?.length ?? "—"} dòng`;
      break;
    }
    case "xlsx": {
      const wb = ensureSheetWorkbook(doc);
      buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer);
      summary = `Excel · ${wb.SheetNames.length} sheet`;
      break;
    }
    case "html": {
      buffer = Buffer.from(doc.html, "utf8");
      summary = "HTML";
      break;
    }
    case "txt": {
      buffer = Buffer.from(doc.text || "", "utf8");
      summary = `TXT · ${doc.text.length} ký tự`;
      break;
    }
    case "pdf": {
      if (options.kind === "pdf" && options.format === "pdf") {
        buffer = input;
        summary = "PDF (giữ nguyên)";
      } else {
        buffer = await textToPdf(doc.text, options.title);
        summary = "PDF";
      }
      break;
    }
    default:
      throw new Error("Format không hợp lệ.");
  }

  return {
    buffer,
    mimeType: DOC_FORMAT_MIME[options.format],
    extension: ext,
    size: buffer.length,
    originalSize,
    summary,
  };
}

/** Stream upload File → Buffer without assuming huge contiguous alloc beyond file size. */
export async function fileToBuffer(file: File): Promise<Buffer> {
  const id = randomUUID();
  const dest = join(tmpdir(), `pixora-doc-${id}`);
  await pipeline(
    Readable.fromWeb(file.stream() as import("stream/web").ReadableStream),
    createWriteStream(dest),
  );
  try {
    return await readFile(dest);
  } finally {
    const { unlink } = await import("fs/promises");
    await unlink(dest).catch(() => undefined);
  }
}
