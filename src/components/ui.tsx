import { useEffect, useRef, type ReactNode, type Ref, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { X } from "lucide-react";
import { cn, signedMoney } from "../lib/format";

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg" };

export function Button({ variant = "secondary", size = "md", className, ...p }: BtnProps) {
  return (
    <button
      type="button"
      {...p}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-5 py-3 text-base",
        variant === "primary" && "bg-accent font-semibold text-black hover:bg-accent/90",
        variant === "secondary" && "border border-border-strong bg-surface-1 text-text-primary hover:bg-surface-2",
        variant === "ghost" && "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
        variant === "danger" && "bg-critical text-white hover:bg-critical/90",
        className
      )}
    />
  );
}

export function Card({ title, action, className, children }: { title?: ReactNode; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-xl border border-border-strong bg-surface-1 p-4 md:p-5", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold text-text-primary">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-border-strong bg-surface-1 px-4 py-3.5">
      <div className="text-xs font-medium text-text-muted">{label}</div>
      <div className={cn("mt-1.5 text-xl font-semibold tabular-nums", tone === "good" && "text-good-text", tone === "bad" && "text-critical-text")}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-text-muted">{sub}</div>}
    </div>
  );
}

export function Pnl({ value, className }: { value: number | null; className?: string }) {
  if (value === null) return <span className={cn("text-text-muted", className)}>—</span>;
  return (
    <span className={cn("font-semibold tabular-nums", value > 0 ? "text-good-text" : value < 0 ? "text-critical-text" : "text-text-secondary", className)}>
      {signedMoney(value)}
    </span>
  );
}

export const inputClass =
  "w-full rounded-lg border border-border-strong bg-surface-0 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-60";

/** `group` = the control is a set of buttons (not a single input), so it must not be wrapped in a <label>. */
export function Field({ label, hint, error, children, className, group }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string; group?: boolean }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className={cn("block", className)} {...(group ? { role: "group", "aria-label": label } : {})}>
      <span className="mb-1.5 block text-xs font-medium text-text-secondary">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-critical-text">{error}</span> : hint ? <span className="mt-1 block text-[11px] text-text-muted">{hint}</span> : null}
    </Tag>
  );
}

export function Input(p: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input {...p} className={cn(inputClass, p.className)} />;
}

export function NumberInput({ value, onChange, ...p }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      {...p}
      value={value === null || Number.isNaN(value) ? "" : value}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      onWheel={(e) => (e.target as HTMLInputElement).blur()}
      className={cn(inputClass, "tabular-nums", p.className)}
    />
  );
}

export function Select(p: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cn(inputClass, "pr-8", p.className)} />;
}

export function Segmented<T extends string>({
  value, onChange, options, className,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string; tone?: "good" | "bad" }[]; className?: string }) {
  return (
    <div className={cn("flex overflow-hidden rounded-lg border border-border-strong", className)} role="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 px-3 py-2.5 text-sm font-medium transition-colors",
              on
                ? o.tone === "good" ? "bg-good/20 text-good-text" : o.tone === "bad" ? "bg-critical/20 text-critical-text" : "bg-accent/20 text-accent"
                : "bg-surface-0 text-text-muted hover:text-text-primary"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "bad" | "warn" | "accent" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
        tone === "neutral" && "bg-surface-2 text-text-secondary",
        tone === "good" && "bg-good/15 text-good-text",
        tone === "bad" && "bg-critical/15 text-critical-text",
        tone === "warn" && "bg-warn/15 text-warn-text",
        tone === "accent" && "bg-accent/15 text-accent"
      )}
    >
      {children}
    </span>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-2xl border border-border-strong bg-surface-1 p-0 text-text-primary backdrop:bg-black/70",
        wide ? "max-w-2xl" : "max-w-md"
      )}
    >
      {open && (
        <div className="p-5 md:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-text-muted hover:bg-surface-2 hover:text-text-primary" aria-label="Close">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Notice({ tone = "accent", icon, children, action }: { tone?: "accent" | "warn" | "bad" | "good"; icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center",
        tone === "accent" && "border-accent/30 bg-accent/10",
        tone === "warn" && "border-warn/30 bg-warn/10",
        tone === "bad" && "border-critical/30 bg-critical/10",
        tone === "good" && "border-good/30 bg-good/10"
      )}
    >
      <div className="flex flex-1 items-start gap-2.5 text-text-secondary">
        {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
        <div>{children}</div>
      </div>
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border-strong px-4 py-5 sm:flex-row sm:items-center sm:justify-between md:px-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {sub && <div className="mt-0.5 text-sm text-text-muted">{sub}</div>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
      {icon && <div className="mb-1 text-text-muted">{icon}</div>}
      <div className="text-base font-semibold">{title}</div>
      {children && <div className="max-w-sm text-sm text-text-muted">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
