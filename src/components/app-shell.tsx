"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSociety } from "@/lib/store";
import { flatLabel } from "@/lib/format";
import { Avatar, Badge, Skeleton } from "./ui";

interface NavItem {
  href: string;
  label: string;
  /** Shorter label for the cramped mobile tab bar. */
  short: string;
  icon: ReactNode;
  adminOrCollectorOnly?: boolean;
}

const icon = (path: ReactNode) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {path}
  </svg>
);

const NAV: NavItem[] = [
  {
    href: "/",
    label: "Home",
    short: "Home",
    icon: icon(<path d="M3 10.5 12 3l9 7.5M5.5 9.5V21h13V9.5" />),
  },
  {
    href: "/funds",
    label: "Funds",
    short: "Funds",
    icon: icon(
      <>
        <path d="M3 6h18v13H3z" />
        <path d="M7 10.5h5M7 14h8" />
      </>,
    ),
  },
  {
    href: "/collect",
    label: "Collect",
    short: "Collect",
    icon: icon(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" />
      </>,
    ),
    adminOrCollectorOnly: true,
  },
  {
    href: "/activities",
    label: "Activities",
    short: "Events",
    icon: icon(
      <>
        <path d="M4 5.5h16V21H4z" />
        <path d="M8 3v4M16 3v4M4 10h16" />
      </>,
    ),
  },
  {
    href: "/gallery",
    label: "Photo gallery",
    short: "Photos",
    icon: icon(
      <>
        <path d="M3 5.5h18v13H3z" />
        <path d="m3 15 5-4 4 3 3-2.5 6 4.5" />
        <circle cx="8.5" cy="9" r="1.4" />
      </>,
    ),
  },
];

const roleLabel = { admin: "Committee admin", collector: "Volunteer collector", resident: "Resident" };
const roleTone = { admin: "brand", collector: "accent", resident: "neutral" } as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { session, ready, data, signOut, isAdmin, canCollect } = useSociety();
  const pathname = usePathname();
  const router = useRouter();

  // Public routes render themselves; everything else needs a signed-in member.
  useEffect(() => {
    if (ready && !session) router.replace("/login");
  }, [ready, session, router]);

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <Skeleton className="h-8 w-56" />
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="mt-6 h-64" />
      </div>
    );
  }

  if (!session) return null;

  const items = NAV.filter((n) => !n.adminOrCollectorOnly || canCollect);
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <SocietyMark />
            <span className="min-w-0">
              <span className="block truncate text-[0.9375rem] font-semibold leading-tight text-ink">
                {data.society.name}
              </span>
              <span className="block text-[0.6875rem] uppercase tracking-[0.06em] text-ink-faint">
                Cultural & fund register
              </span>
            </span>
          </Link>
          <div className="ml-auto">
            <AccountMenu
              name={session.name}
              detail={flatLabel(session.wing, session.flat)}
              role={session.role}
              isAdmin={isAdmin}
              onSignOut={signOut}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4 py-5 sm:py-7">
        <nav aria-label="Sections" className="hidden w-52 shrink-0 md:block">
          <ul className="sticky top-20 space-y-0.5">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-brand-soft text-brand-ink"
                      : "text-ink-soft hover:bg-surface-sunken hover:text-ink"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            ))}
            {isAdmin ? (
              <li className="pt-2">
                <Link
                  href="/admin"
                  aria-current={isActive("/admin") ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors ${
                    isActive("/admin")
                      ? "bg-brand-soft text-brand-ink"
                      : "text-ink-soft hover:bg-surface-sunken hover:text-ink"
                  }`}
                >
                  {icon(
                    <>
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
                    </>,
                  )}
                  Manage
                </Link>
              </li>
            ) : null}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 pb-24 md:pb-6">{children}</main>
      </div>

      {/* Mobile tab bar */}
      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="flex">
          {items.map((item) => (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[0.6875rem] font-medium transition-colors ${
                  isActive(item.href) ? "text-brand" : "text-ink-faint"
                }`}
              >
                {item.icon}
                {item.short}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function SocietyMark() {
  return (
    <span
      aria-hidden
      className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-brand text-white"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 20V9.5L12 4l8 5.5V20"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M9.5 20v-5h5v5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function AccountMenu({
  name,
  detail,
  role,
  isAdmin,
  onSignOut,
}: {
  name: string;
  detail: string;
  role: "admin" | "collector" | "resident";
  isAdmin: boolean;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-surface-sunken"
      >
        <Avatar name={name} tone={role === "collector" ? "accent" : "brand"} />
        <span className="hidden text-left sm:block">
          <span className="block text-[0.8125rem] font-medium leading-tight text-ink">{name}</span>
          <span className="block text-[0.6875rem] leading-tight text-ink-faint">{detail}</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="m5 8 5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-fade-in absolute right-0 top-[calc(100%+0.5rem)] w-60 overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-medium text-ink">{name}</p>
            <p className="mt-0.5 text-xs text-ink-soft">{detail}</p>
            <Badge tone={roleTone[role]} className="mt-2">
              {roleLabel[role]}
            </Badge>
          </div>
          {isAdmin ? (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink md:hidden"
            >
              Manage society
            </Link>
          ) : null}
          <Link
            href="/funds/report"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            Transparency report
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="block w-full px-4 py-2.5 text-left text-sm text-debit transition-colors hover:bg-debit-soft"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
