"use client";

import { useCallback, useMemo, useRef, useState, type DragEvent } from "react";
import JSZip from "jszip";
import { AppShell } from "@/components/app-shell";
import { IconClose, IconDownload, IconPlus, IconTrash } from "@/components/icons";
import {
  JobQueueList,
  isAbortError,
  type JobStatus,
} from "@/components/item-progress";
import { formatBytes, uniqueFilename } from "@/lib/format";
import {
  DOC_ACCEPT,
  DOC_FORMAT_EXT,
  DOC_FORMATS,
  MAX_DOCS,
  MAX_DOC_BYTES,
  allowedOutputs,
  detectDocKind,
  type DocOutputFormat,
} from "@/lib/doc-format";

type SourceItem = { id: string; file: File; kind: NonNullable<ReturnType<typeof detectDocKind>> };

type ResultItem = {
  id: string;
  filename: string;
  url: string;
  originalSize: number;
  outputSize: number;
  summary: string;
  format: DocOutputFormat;
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function headerNum(res: Response, key: string, fallback = 0) {
  return Number(res.headers.get(key) || fallback);
}

function outputFilename(originalName: string, format: DocOutputFormat, index: number): string {
  const base = originalName.replace(/\.[^.]+$/i, "").trim() || `doc-${index + 1}`;
  return `${base}.${DOC_FORMAT_EXT[format]}`;
}

function kindLabel(kind: string) {
  return kind.toUpperCase();
}

export function DocsWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [items, setItems] = useState<SourceItem[]>([]);
  const [format, setFormat] = useState<DocOutputFormat>("pdf");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [jobStatus, setJobStatus] = useState<Record<string, JobStatus>>({});
  const [jobErrors, setJobErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const totals = useMemo(() => {
    if (!results.length) return null;
    const originalSize = results.reduce((s, r) => s + r.originalSize, 0);
    const outputSize = results.reduce((s, r) => s + r.outputSize, 0);
    return { originalSize, outputSize };
  }, [results]);

  const availableFormats = useMemo(() => {
    if (!items.length) return DOC_FORMATS;
    const allowed = new Set(items.flatMap((item) => allowedOutputs(item.kind)));
    return DOC_FORMATS.filter((f) => allowed.has(f.id));
  }, [items]);

  const clearResults = useCallback(() => {
    setResults((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.url));
      return [];
    });
  }, []);

  const clearJobs = useCallback(() => {
    setJobStatus({});
    setJobErrors({});
    setProgress({ done: 0, total: 0, current: "" });
  }, []);

  const clearSources = useCallback(() => {
    setItems([]);
  }, []);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const incoming = Array.from(list);
      const accepted: SourceItem[] = [];
      let rejected = false;

      for (const file of incoming) {
        const kind = detectDocKind(file);
        if (!kind) {
          rejected = true;
          continue;
        }
        if (file.size > MAX_DOC_BYTES) {
          setError(`“${file.name}” vượt 50MB — đã bỏ qua.`);
          continue;
        }
        accepted.push({ id: makeId(), file, kind });
      }

      if (!accepted.length) {
        setError(
          rejected
            ? "Chỉ nhận PDF, Excel, CSV, HTML, DOCX, TXT, Markdown."
            : "Không có file hợp lệ.",
        );
        return;
      }

      setError(null);
      clearResults();
      clearJobs();

      setItems((prev) => {
        const room = MAX_DOCS - prev.length;
        if (room <= 0) {
          setError(`Tối đa ${MAX_DOCS} file.`);
          return prev;
        }
        if (accepted.length > room) {
          setError(`Chỉ thêm được ${room} file nữa (tối đa ${MAX_DOCS}).`);
        }
        const next = [...prev, ...accepted.slice(0, room)];
        const allowed = new Set(next.flatMap((item) => allowedOutputs(item.kind)));
        if (!allowed.has(format)) {
          const first = DOC_FORMATS.find((f) => allowed.has(f.id));
          if (first) setFormat(first.id);
        }
        return next;
      });
    },
    [clearJobs, clearResults, format],
  );

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    clearResults();
    clearJobs();
  };

  const processAll = async () => {
    if (!items.length) {
      setError("Hãy upload ít nhất 1 file.");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    clearResults();

    const queued: Record<string, JobStatus> = {};
    for (const item of items) queued[item.id] = "queued";
    setJobStatus(queued);
    setJobErrors({});
    setProgress({ done: 0, total: items.length, current: items[0]?.file.name || "" });

    const next: ResultItem[] = [];
    const errors: string[] = [];
    let cancelled = false;

    for (let i = 0; i < items.length; i += 1) {
      if (controller.signal.aborted) {
        cancelled = true;
        setJobStatus((prev) => {
          const copy = { ...prev };
          for (let j = i; j < items.length; j += 1) {
            if (copy[items[j].id] === "queued" || copy[items[j].id] === "processing") {
              copy[items[j].id] = "cancelled";
            }
          }
          return copy;
        });
        break;
      }

      const item = items[i];
      setJobStatus((prev) => ({ ...prev, [item.id]: "processing" }));
      setProgress({ done: i, total: items.length, current: item.file.name });

      try {
        if (!allowedOutputs(item.kind).includes(format)) {
          throw new Error(`Không convert ${kindLabel(item.kind)} → ${format.toUpperCase()}.`);
        }

        const body = new FormData();
        body.append("file", item.file);
        body.append("format", format);

        const response = await fetch("/api/process-doc", {
          method: "POST",
          body,
          signal: controller.signal,
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error || `Lỗi khi convert “${item.file.name}”.`);
        }

        const blob = await response.blob();
        const summaryHeader = response.headers.get("X-Summary");
        next.push({
          id: item.id,
          filename: outputFilename(item.file.name, format, i),
          url: URL.createObjectURL(blob),
          originalSize: headerNum(response, "X-Original-Size", item.file.size),
          outputSize: headerNum(response, "X-Output-Size", blob.size),
          summary: summaryHeader ? decodeURIComponent(summaryHeader) : format.toUpperCase(),
          format,
        });

        setJobStatus((prev) => ({ ...prev, [item.id]: "done" }));
        setResults([...next]);
      } catch (err) {
        if (isAbortError(err)) {
          cancelled = true;
          setJobStatus((prev) => {
            const copy = { ...prev, [item.id]: "cancelled" as JobStatus };
            for (let j = i + 1; j < items.length; j += 1) {
              copy[items[j].id] = "cancelled";
            }
            return copy;
          });
          break;
        }
        const message = err instanceof Error ? err.message : "Có lỗi xảy ra.";
        errors.push(`“${item.file.name}”: ${message}`);
        setJobStatus((prev) => ({ ...prev, [item.id]: "error" }));
        setJobErrors((prev) => ({ ...prev, [item.id]: message }));
      }

      setProgress({ done: i + 1, total: items.length, current: item.file.name });
    }

    if (cancelled) {
      setError(
        next.length
          ? `Đã hủy. Giữ ${next.length}/${items.length} file đã xong.`
          : "Đã hủy quá trình convert.",
      );
    } else if (errors.length) {
      setError(
        errors.length === 1
          ? errors[0]
          : `${errors.length}/${items.length} file lỗi. Xem chi tiết từng mục.`,
      );
    }

    if (abortRef.current === controller) abortRef.current = null;
    setLoading(false);
  };

  const cancelProcess = () => {
    abortRef.current?.abort();
  };

  const downloadZip = async () => {
    if (!results.length) return;
    const zip = new JSZip();
    const used = new Set<string>();

    for (const item of results) {
      const name = uniqueFilename(item.filename, used);
      const blob = await fetch(item.url).then((r) => r.blob());
      zip.file(name, blob);
    }

    const url = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pixora-docs-${results.length}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pendingItems = loading
    ? items.filter((item) => {
        const status = jobStatus[item.id];
        return status === "queued" || status === "processing";
      })
    : [];

  return (
    <AppShell
      title="Pixora"
      subtitle="Convert PDF · Excel · HTML · DOCX"
      toolbar={
        <>
          <div
            className={`flex gap-1 rounded-lg bg-[#eef2f7] p-1 ${loading ? "pointer-events-none opacity-50" : ""}`}
          >
            {availableFormats.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={loading}
                onClick={() => setFormat(item.id)}
                className={`rounded-md px-2.5 py-1.5 text-xs transition sm:text-sm disabled:cursor-not-allowed ${
                  format === item.id
                    ? "bg-white text-[#10233a] shadow-sm"
                    : "text-[#6b7789] hover:text-[#243247]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <span className="hidden text-xs text-[#6b7789] sm:inline">
            PDF · Excel · CSV · HTML · DOCX · TXT · MD
          </span>

          <div className="ml-auto flex items-center gap-2">
            {loading ? (
              <button
                type="button"
                onClick={cancelProcess}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#f0c2c2] bg-[#fff5f5] px-4 text-sm font-medium text-[#9b2c2c] transition hover:bg-[#ffe8e8]"
              >
                Hủy
              </button>
            ) : null}
            <button
              type="button"
              onClick={processAll}
              disabled={!items.length || loading}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#10233a] px-4 text-sm font-medium text-white transition hover:bg-[#1d2f46] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? `${progress.done}/${progress.total}`
                : `Convert${items.length ? ` ${items.length}` : ""}`}
            </button>
            <button
              type="button"
              onClick={downloadZip}
              disabled={!results.length}
              title="Tải ZIP tất cả"
              aria-label="Tải ZIP tất cả"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#c9d2de] bg-white text-[#243247] transition hover:bg-[#f5f7fa] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconDownload />
            </button>
          </div>
        </>
      }
    >
      {error ? (
        <div
          role="alert"
          className="flex shrink-0 items-start gap-2 rounded-xl border border-[#f0c2c2] bg-[#fff5f5] px-3 py-2 text-sm text-[#9b2c2c]"
        >
          <p className="min-w-0 flex-1">{error}</p>
          <button
            type="button"
            aria-label="Đóng"
            onClick={() => setError(null)}
            className="shrink-0 rounded-md p-0.5 text-[#9b2c2c]/80 transition hover:bg-[#f8e0e0] hover:text-[#9b2c2c]"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <section className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!loading) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e: DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setDragOver(false);
            if (loading) return;
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
          className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-dashed bg-white/75 backdrop-blur-sm transition ${
            dragOver ? "border-[#1f6feb] bg-[#eef5ff]/90" : "border-[#c9d2de]"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={DOC_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#e4eaf2] px-3 py-2.5">
            <p className="text-sm font-medium text-[#243247]">
              Tài liệu {items.length ? `(${items.length})` : ""}
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={loading}
                title="Thêm file"
                aria-label="Thêm file"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#c9d2de] bg-white text-[#243247] transition hover:bg-[#f5f7fa] disabled:opacity-40"
              >
                <IconPlus />
              </button>
              {items.length > 0 ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    clearSources();
                    clearResults();
                    clearJobs();
                    setError(null);
                  }}
                  title="Xóa hết"
                  aria-label="Xóa hết"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6b7789] transition hover:bg-[#fff5f5] hover:text-[#9b2c2c] disabled:opacity-40"
                >
                  <IconTrash />
                </button>
              ) : null}
            </div>
          </div>

          {items.length === 0 ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 text-center"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#10233a] text-base text-white">
                ↑
              </span>
              <span className="text-sm font-medium text-[#243247]">
                Kéo thả hoặc chọn PDF / Excel / HTML…
              </span>
              <span className="text-xs text-[#6b7789]">Tối đa {MAX_DOCS} · ≤ 50MB/file</span>
            </button>
          ) : (
            <ul className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="relative flex items-center gap-3 rounded-xl border border-[#e4eaf2] bg-white px-2.5 py-2"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#eef2f7] text-[10px] font-semibold text-[#51657d]">
                    {kindLabel(item.kind)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[#243247]" title={item.file.name}>
                      {item.file.name}
                    </p>
                    <p className="text-[11px] text-[#6b7789]">{formatBytes(item.file.size)}</p>
                  </div>
                  {jobStatus[item.id] ? (
                    <span
                      className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold ${
                        jobStatus[item.id] === "processing"
                          ? "bg-[#eef5ff] text-[#1f6feb]"
                          : jobStatus[item.id] === "done"
                            ? "bg-[#e8f7ef] text-[#0f7a4a]"
                            : jobStatus[item.id] === "error"
                              ? "bg-[#fff5f5] text-[#9b2c2c]"
                              : jobStatus[item.id] === "cancelled"
                                ? "bg-[#eef2f7] text-[#6b7789]"
                                : "bg-[#eef2f7] text-[#51657d]"
                      }`}
                    >
                      {jobStatus[item.id] === "processing"
                        ? "…"
                        : jobStatus[item.id] === "done"
                          ? "✓"
                          : jobStatus[item.id] === "error"
                            ? "!"
                            : jobStatus[item.id] === "cancelled"
                              ? "–"
                              : "Chờ"}
                    </span>
                  ) : null}
                  {!loading ? (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#6b7789] transition hover:bg-[#fff5f5] hover:text-[#9b2c2c]"
                      aria-label={`Xóa ${item.file.name}`}
                      title="Xóa"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#d5dde8] bg-white/80 backdrop-blur-sm">
          <div className="flex h-13 shrink-0 items-center justify-between gap-2 border-b border-[#e4eaf2] px-3 py-2.5">
            <p className="text-sm font-medium text-[#243247]">
              Kết quả {results.length ? `(${results.length})` : ""}
              {loading ? (
                <span className="ml-2 text-xs font-normal text-[#6b7789]">
                  {progress.done}/{progress.total}
                  {progress.current ? ` · ${progress.current}` : ""}
                </span>
              ) : null}
            </p>
            {totals ? (
              <p className="text-xs text-[#6b7789]">
                {formatBytes(totals.originalSize)} → {formatBytes(totals.outputSize)}
              </p>
            ) : null}
          </div>

          {!results.length && !loading && Object.keys(jobStatus).length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-[#7a8698]">
              Kết quả hiện ở đây sau khi Convert
            </div>
          ) : null}

          {results.length > 0 || loading || Object.keys(jobStatus).length > 0 ? (
            <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
              {results.length > 0 ? (
                <ul className="space-y-2">
                  {results.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border border-[#e4eaf2] bg-white px-2.5 py-2"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#eef2f7] text-[10px] font-semibold text-[#51657d]">
                        {item.format.toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-[#243247]" title={item.filename}>
                          {item.filename}
                        </p>
                        <p className="truncate text-[11px] text-[#6b7789]">
                          {item.summary} · {formatBytes(item.originalSize)} →{" "}
                          <span className="font-medium text-[#243247]">
                            {formatBytes(item.outputSize)}
                          </span>
                        </p>
                      </div>
                      <a
                        href={item.url}
                        download={item.filename}
                        title="Tải xuống"
                        aria-label={`Tải ${item.filename}`}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#c9d2de] text-[#243247] transition hover:bg-[#f5f7fa]"
                      >
                        <IconDownload />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}

              {pendingItems.length ? (
                <JobQueueList
                  items={pendingItems.map((item) => ({ id: item.id, name: item.file.name }))}
                  statuses={jobStatus}
                  errors={jobErrors}
                  actionLabel="convert"
                  className="space-y-2"
                />
              ) : null}

              {!loading && !results.length && Object.keys(jobStatus).length > 0 ? (
                <JobQueueList
                  items={items.map((item) => ({ id: item.id, name: item.file.name }))}
                  statuses={jobStatus}
                  errors={jobErrors}
                  actionLabel="convert"
                  className="space-y-2"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
