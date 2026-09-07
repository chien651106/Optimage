export type DocOutputFormat = "pdf" | "xlsx" | "csv" | "html" | "txt";

export const DOC_FORMATS: { id: DocOutputFormat; label: string }[] = [
  { id: "pdf", label: "PDF" },
  { id: "xlsx", label: "Excel" },
  { id: "csv", label: "CSV" },
  { id: "html", label: "HTML" },
  { id: "txt", label: "TXT" },
];

export const DOC_FORMAT_EXT: Record<DocOutputFormat, string> = {
  pdf: "pdf",
  xlsx: "xlsx",
  csv: "csv",
  html: "html",
  txt: "txt",
};

export const DOC_FORMAT_MIME: Record<DocOutputFormat, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
  html: "text/html; charset=utf-8",
  txt: "text/plain; charset=utf-8",
};

export const MAX_DOCS = 20;
export const MAX_DOC_BYTES = 50 * 1024 * 1024;

export const DOC_ACCEPT =
  ".pdf,.xlsx,.xls,.csv,.html,.htm,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";

export type DocInputKind = "pdf" | "xlsx" | "csv" | "html" | "docx" | "txt" | "md";

export function detectDocKind(file: File): DocInputKind | null {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (type.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (
    type.includes("spreadsheetml") ||
    type.includes("excel") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls")
  ) {
    return "xlsx";
  }
  if (type.includes("csv") || name.endsWith(".csv")) return "csv";
  if (type.includes("html") || name.endsWith(".html") || name.endsWith(".htm")) return "html";
  if (type.includes("wordprocessingml") || name.endsWith(".docx")) return "docx";
  if (name.endsWith(".md") || name.endsWith(".markdown") || type.includes("markdown")) return "md";
  if (type.startsWith("text/") || name.endsWith(".txt")) return "txt";
  return null;
}

/** Which outputs make sense for a given source kind. */
export function allowedOutputs(kind: DocInputKind): DocOutputFormat[] {
  switch (kind) {
    case "xlsx":
    case "csv":
      return ["xlsx", "csv", "html", "pdf", "txt"];
    case "pdf":
      return ["txt", "html", "pdf"];
    case "docx":
      return ["html", "txt", "pdf"];
    case "html":
    case "md":
    case "txt":
      return ["html", "txt", "pdf"];
    default:
      return ["pdf", "html", "txt"];
  }
}
