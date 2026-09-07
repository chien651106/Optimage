"use client";

import type { ReactNode } from "react";
import { IconClose, IconDownload } from "@/components/icons";
import { formatBytes, formatSavedLabel, sizeSavedPercent } from "@/lib/format";

export function ErrorBanner({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex shrink-0 items-start gap-2 rounded-xl border border-[#f0c2c2] bg-[#fff5f5] px-3 py-2 text-sm text-[#9b2c2c]"
    >
      <p className="min-w-0 flex-1">{message}</p>
      <button
        type="button"
        aria-label="Đóng"
        onClick={onClose}
        className="shrink-0 rounded-md p-0.5 text-[#9b2c2c]/80 transition hover:bg-[#f8e0e0] hover:text-[#9b2c2c]"
      >
        <IconClose className="h-4 w-4" />
      </button>
    </div>
  );
}

export function SavedBadge({
  originalSize,
  outputSize,
}: {
  originalSize: number;
  outputSize: number;
}) {
  const saved = sizeSavedPercent(originalSize, outputSize);
  const tone =
    saved > 0
      ? "bg-[#e8f7ef] text-[#0f7a4a]"
      : saved < 0
        ? "bg-[#fff5f5] text-[#9b2c2c]"
        : "bg-[#eef2f7] text-[#51657d]";

  return (
    <span
      className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${tone}`}
      title={`${formatBytes(originalSize)} → ${formatBytes(outputSize)}`}
    >
      {formatSavedLabel(saved)}
    </span>
  );
}

export function ResultRow({
  thumb,
  filename,
  meta,
  badge,
  downloadUrl,
}: {
  thumb: ReactNode;
  filename: string;
  meta: ReactNode;
  badge?: ReactNode;
  downloadUrl: string;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-[#e4eaf2] bg-white px-2.5 py-2">
      {thumb}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-[#243247]" title={filename}>
          {filename}
        </p>
        <p className="truncate text-[11px] text-[#6b7789]">{meta}</p>
      </div>
      {badge}
      <a
        href={downloadUrl}
        download={filename}
        title="Tải xuống"
        aria-label={`Tải ${filename}`}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#c9d2de] text-[#243247] transition hover:bg-[#f5f7fa]"
      >
        <IconDownload />
      </a>
    </li>
  );
}
