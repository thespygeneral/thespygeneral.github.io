import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { parseLocal } from "./calc";

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));

export function money(v: number): string {
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function signedMoney(v: number): string {
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Prices: keep up to 6 decimals (futures/currencies), but at least 2. */
export function price(v: number | null): string {
  if (v === null) return "—";
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

export function qty(v: number): string {
  return v.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export function dateLabel(s: string | null): string {
  if (!s) return "—";
  const d = parseLocal(s);
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (s.length <= 10) return day;
  return `${day}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

export function holdLabel(min: number | null): string {
  if (min === null) return "—";
  if (min < 60) return `${min}m`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}h ${min % 60}m`;
  return `${Math.round(min / 60 / 24)}d`;
}

export function nowLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function todayLocal(): string {
  return nowLocal().slice(0, 10);
}

export function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
}
