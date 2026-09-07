"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconDocs, IconImage, IconVideo } from "@/components/icons";

const TABS = [
  { href: "/", label: "Ảnh", Icon: IconImage },
  { href: "/video", label: "Video", Icon: IconVideo },
  { href: "/docs", label: "Docs", Icon: IconDocs },
] as const;

export function AppShell({
  title,
  subtitle,
  toolbar,
  navLocked = false,
  children,
}: {
  title: string;
  subtitle: string;
  toolbar?: ReactNode;
  navLocked?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="relative h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_12%,#9fd0ff_0%,transparent_38%),radial-gradient(circle_at_92%_0%,#7dd3c7_0%,transparent_30%),linear-gradient(165deg,#e8f1f8_0%,#edf3f8_50%,#e6eef5_100%)]" />

      <nav
        aria-label="Chuyển chế độ"
        aria-disabled={navLocked || undefined}
        className={`absolute top-1/2 left-0 z-20 flex -translate-y-1/2 flex-col gap-1 rounded-r-xl border border-l-0 border-[#d5dde8]/80 bg-white/80 p-1.5 backdrop-blur-sm ${
          navLocked ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {TABS.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const { Icon } = tab;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              title={navLocked ? "Đang xử lý — chờ xong để chuyển trang" : tab.label}
              tabIndex={navLocked ? -1 : undefined}
              className={`group relative flex h-10 w-10 items-center justify-center rounded-lg transition ${
                active
                  ? "bg-[#10233a] text-white"
                  : "text-[#6b7789] hover:bg-[#eef2f7] hover:text-[#243247]"
              }`}
              onClick={(e) => {
                if (navLocked) e.preventDefault();
              }}
            >
              <Icon className="h-5 w-5" />
              <span
                className="pointer-events-none absolute top-1/2 left-[calc(100%+10px)] z-30 -translate-y-1/2 rounded-md bg-[#10233a] px-2 py-1 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-visible:opacity-100"
                role="tooltip"
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <main className="relative ml-14 flex h-full w-[calc(100%-3.5rem)] max-w-[1400px] flex-col gap-3 p-3 sm:gap-4 sm:p-4">
        <header className="flex shrink-0 flex-col gap-2">
          <div className="rounded-2xl border border-[#d5dde8]/80 bg-white/75 px-4 py-3 backdrop-blur-sm">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[#10233a] sm:text-3xl">
              {title}
            </h1>
            <p className="mt-0.5 text-xs text-[#6b7789] sm:text-sm">{subtitle}</p>
          </div>

          {toolbar ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#d5dde8]/80 bg-white/75 px-3 py-2.5 backdrop-blur-sm sm:px-4">
              {toolbar}
            </div>
          ) : null}
        </header>

        {children}
      </main>
    </div>
  );
}
