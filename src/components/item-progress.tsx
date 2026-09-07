type JobStatus = "queued" | "processing" | "done" | "error" | "cancelled";

export function ItemStatusBadge({ status }: { status?: JobStatus }) {
  if (!status || status === "queued") {
    return (
      <span className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5 text-center text-[10px] font-medium text-white/90">
        Chờ…
      </span>
    );
  }

  if (status === "processing") {
    return (
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-white">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        <span className="text-[10px] font-medium">Đang xử lý</span>
      </span>
    );
  }

  if (status === "done") {
    return (
      <span className="absolute left-1 top-1 inline-flex h-5 min-w-5 items-center justify-center rounded bg-[#0f7a4a] px-1 text-[10px] font-semibold text-white">
        ✓
      </span>
    );
  }

  if (status === "cancelled") {
    return (
      <span className="absolute left-1 top-1 inline-flex h-5 min-w-5 items-center justify-center rounded bg-[#6b7789] px-1 text-[10px] font-semibold text-white">
        –
      </span>
    );
  }

  return (
    <span className="absolute left-1 top-1 inline-flex h-5 min-w-5 items-center justify-center rounded bg-[#9b2c2c] px-1 text-[10px] font-semibold text-white">
      !
    </span>
  );
}

export function JobQueueList({
  items,
  statuses,
  errors,
  actionLabel = "xử lý",
  className = "min-h-0 flex-1 space-y-2 overflow-auto p-3",
}: {
  items: { id: string; name: string }[];
  statuses: Record<string, JobStatus>;
  errors: Record<string, string>;
  actionLabel?: string;
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <ul className={className}>
      {items.map((item, index) => {
        const status = statuses[item.id] ?? "queued";
        const label =
          status === "processing"
            ? `Đang ${actionLabel}…`
            : status === "done"
              ? "Xong"
              : status === "cancelled"
                ? "Đã hủy"
                : status === "error"
                  ? errors[item.id] || "Lỗi"
                  : `Chờ (${index + 1}/${items.length})`;

        return (
          <li
            key={item.id}
            className={`flex items-center gap-3 rounded-xl border px-2.5 py-2 ${
              status === "processing"
                ? "border-[#1f6feb]/40 bg-[#eef5ff]"
                : status === "error"
                  ? "border-[#f0c2c2] bg-[#fff5f5]"
                  : status === "cancelled"
                    ? "border-[#d5dde8] bg-[#f5f7fa]"
                    : status === "done"
                      ? "border-[#c6e6d5] bg-[#f3fbf7]"
                      : "border-[#e4eaf2] bg-white"
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#f3f6fa] text-xs font-medium text-[#51657d]">
              {status === "processing" ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#c9d2de] border-t-[#10233a]" />
              ) : status === "done" ? (
                <span className="text-[#0f7a4a]">✓</span>
              ) : status === "error" ? (
                <span className="text-[#9b2c2c]">!</span>
              ) : status === "cancelled" ? (
                <span className="text-[#6b7789]">–</span>
              ) : (
                index + 1
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-[#243247]" title={item.name}>
                {item.name}
              </p>
              <p
                className={`truncate text-[11px] ${
                  status === "error" ? "text-[#9b2c2c]" : "text-[#6b7789]"
                }`}
              >
                {label}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export type { JobStatus };

export function isAbortError(err: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      err instanceof DOMException &&
      err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}
