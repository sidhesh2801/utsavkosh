"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { initials, money, percent } from "@/lib/format";

/* ------------------------------------------------------------------ layout */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[1.375rem] font-semibold tracking-[-0.01em] text-ink sm:text-2xl">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-soft">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  return <Tag className={`card ${className}`}>{children}</Tag>;
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[0.8125rem] font-semibold uppercase tracking-[0.06em] text-ink-faint">
        {children}
      </h2>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ button */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-deep disabled:bg-brand/50",
  accent: "bg-accent text-white hover:brightness-95 disabled:opacity-50",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-surface-sunken disabled:text-ink-faint",
  ghost: "text-ink-soft hover:bg-surface-sunken hover:text-ink",
  danger: "bg-debit text-white hover:brightness-95 disabled:opacity-50",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizes = {
    sm: "px-2.5 py-1.5 text-[0.8125rem]",
    md: "px-3.5 py-2 text-sm",
    lg: "px-5 py-3 text-[0.9375rem]",
  };
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-[10px] font-medium transition-colors disabled:cursor-not-allowed ${buttonStyles[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * A link that looks like a button. Kept separate rather than giving `Button` an
 * `asChild` prop, because a `<Link>` nested inside a `<button>` is invalid HTML
 * and breaks keyboard activation.
 */
export function LinkButton({
  href,
  children,
  variant = "primary",
  size = "md",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "px-2.5 py-1.5 text-[0.8125rem]",
    md: "px-3.5 py-2 text-sm",
    lg: "px-5 py-3 text-[0.9375rem]",
  };
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-1.5 rounded-[10px] font-medium transition-colors ${buttonStyles[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------- badge */

type Tone = "neutral" | "brand" | "credit" | "debit" | "warn" | "accent";

const toneStyles: Record<Tone, string> = {
  neutral: "bg-surface-sunken text-ink-soft",
  brand: "bg-brand-soft text-brand-ink",
  credit: "bg-credit-soft text-credit",
  debit: "bg-debit-soft text-debit",
  warn: "bg-warn-soft text-warn",
  accent: "bg-accent-soft text-accent",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] ${toneStyles[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- stat tile */

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: Tone;
}) {
  const valueTone =
    tone === "credit"
      ? "text-credit"
      : tone === "debit"
        ? "text-debit"
        : tone === "warn"
          ? "text-warn"
          : tone === "brand"
            ? "text-brand"
            : "text-ink";
  return (
    <div className="card p-3.5">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-ink-faint">
        {label}
      </p>
      {/* Proportional figures: tabular digits make a large standalone number
          look loose. `tnum` is reserved for columns that align vertically. */}
      <p className={`mt-1.5 text-xl font-semibold tracking-[-0.01em] ${valueTone}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs leading-snug text-ink-soft">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------- meter */

export function Meter({
  value,
  total,
  tone = "brand",
  label,
  showPct = true,
}: {
  value: number;
  total: number;
  tone?: "brand" | "credit" | "debit" | "warn";
  label?: ReactNode;
  showPct?: boolean;
}) {
  const pct = percent(value, total);
  const over = pct > 100;
  const key = over ? "debit" : tone;
  const barTone = {
    brand: "bg-brand",
    credit: "bg-credit",
    debit: "bg-debit",
    warn: "bg-warn",
  }[key];
  // The unfilled track is a lighter step of the fill's own ramp, so the state
  // reads across the whole bar rather than fill-against-grey.
  const trackTone = {
    brand: "bg-brand-soft",
    credit: "bg-credit-soft",
    debit: "bg-debit-soft",
    warn: "bg-warn-soft",
  }[key];

  return (
    <div>
      {label || showPct ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          <span className="text-ink-soft">{label}</span>
          {showPct ? (
            <span className={`tnum font-semibold ${over ? "text-debit" : "text-ink-soft"}`}>
              {pct}%
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        className={`h-2 overflow-hidden rounded-full ${trackTone}`}
        role="progressbar"
        aria-valuenow={Math.min(pct, 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${barTone}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ avatar */

export function Avatar({
  name,
  size = "md",
  tone = "brand",
}: {
  name: string;
  size?: "sm" | "md";
  tone?: "brand" | "accent" | "neutral";
}) {
  const sizes = { sm: "h-7 w-7 text-[0.625rem]", md: "h-9 w-9 text-xs" };
  const tones = {
    brand: "bg-brand-soft text-brand-ink",
    accent: "bg-accent-soft text-accent",
    neutral: "bg-surface-sunken text-ink-soft",
  };
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${sizes[size]} ${tones[tone]}`}
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------- empty state */

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      {icon ? <div className="mb-3 text-ink-faint">{icon}</div> : null}
      <p className="font-medium text-ink">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-soft">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ fields */

export function Field({
  label,
  hint,
  error,
  children,
  required,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.8125rem] font-medium text-ink">
        {label}
        {required ? <span className="ml-0.5 text-debit">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-debit">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-ink-faint">{hint}</span>
      ) : null}
    </label>
  );
}

/** Rupee-prefixed numeric input. Keeps the phone keypad numeric on mobile. */
export function MoneyInput({
  value,
  onChange,
  placeholder = "0",
  autoFocus,
  id,
}: {
  value: number | "";
  onChange: (value: number | "") => void;
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
        ₹
      </span>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        autoFocus={autoFocus}
        className="field tnum pl-7 text-base font-medium"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      />
    </div>
  );
}

/** Quick-pick chips for the amounts residents actually give. */
export function AmountChips({
  amounts,
  onPick,
  active,
}: {
  amounts: number[];
  onPick: (amount: number) => void;
  active?: number | "";
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {amounts.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onPick(a)}
          className={`tnum rounded-full border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors ${
            active === a
              ? "border-brand bg-brand text-white"
              : "border-line-strong bg-surface text-ink-soft hover:border-brand hover:text-brand"
          }`}
        >
          {money(a)}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- sheet */

/**
 * Bottom sheet on phones, centred dialog on desktop. Used for every add/edit
 * form so the underlying list stays visible as context.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the panel so keyboard and screen-reader users land here.
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="animate-fade-in absolute inset-0 bg-ink/40"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="animate-sheet-in relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-surface shadow-xl outline-none sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="font-semibold text-ink">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-soft">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-surface px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ toasts */

interface Toast {
  id: number;
  message: string;
  tone: "success" | "error";
}

const ToastContext = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const show = (message: string, tone: Toast["tone"] = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  };

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[max(5.5rem,env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-sheet-in pointer-events-auto max-w-sm rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
              t.tone === "error" ? "bg-debit" : "bg-brand-deep"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ------------------------------------------------------------------- misc */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-sunken ${className}`} />;
}

/** Simple confirm-before-destroying prompt, since these delete real records. */
export function useConfirm() {
  return (message: string) => (typeof window === "undefined" ? false : window.confirm(message));
}
