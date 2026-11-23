import { useSearchParams } from "react-router";
import { format, subDays, startOfMonth, startOfYear } from "date-fns";
import { cn } from "../lib/format";
import { inputClass } from "./ui";
import { useJournal } from "../lib/journal";
import type { TradeRow } from "../lib/calc";
import { tradeDay } from "../lib/calc";
import type { AssetClass } from "../lib/types";

const f = (d: Date) => format(d, "yyyy-MM-dd");
const PRESETS = [
  { key: "all", label: "All time", range: () => ["", ""] },
  { key: "7d", label: "7 days", range: () => [f(subDays(new Date(), 6)), ""] },
  { key: "30d", label: "30 days", range: () => [f(subDays(new Date(), 29)), ""] },
  { key: "month", label: "This month", range: () => [f(startOfMonth(new Date())), ""] },
  { key: "year", label: "This year", range: () => [f(startOfYear(new Date())), ""] },
];

export type FilterState = { from: string; to: string; type: AssetClass | ""; account: string; symbol: string; status: string; strategy: string; tag: string; mistake: string };

export function useFilters() {
  const [sp, setSp] = useSearchParams();
  const state: FilterState = {
    from: sp.get("from") ?? "",
    to: sp.get("to") ?? "",
    type: (sp.get("type") as AssetClass) ?? "",
    account: sp.get("account") ?? "",
    symbol: sp.get("symbol") ?? "",
    status: sp.get("status") ?? "",
    strategy: sp.get("strategy") ?? "",
    tag: sp.get("tag") ?? "",
    mistake: sp.get("mistake") ?? "",
  };
  const set = (patch: Partial<FilterState>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setSp(next, { replace: true });
  };
  const apply = (rows: TradeRow[]) =>
    rows.filter((r) => {
      const day = tradeDay(r);
      if (state.from && day < state.from) return false;
      if (state.to && day > state.to) return false;
      if (state.type && r.trade.assetClass !== state.type) return false;
      if (state.account && r.trade.account !== state.account) return false;
      if (state.symbol && !r.trade.symbol.includes(state.symbol.toUpperCase())) return false;
      if (state.status && r.s.status !== state.status) return false;
      if (state.strategy && r.trade.strategy !== state.strategy) return false;
      if (state.tag && !r.trade.tags.includes(state.tag)) return false;
      if (state.mistake && !(r.trade.mistakes ?? []).includes(state.mistake)) return false;
      return true;
    });
  const active = Object.values(state).some(Boolean);
  return { state, set, apply, active, clear: () => setSp(new URLSearchParams(), { replace: true }) };
}

export function FilterBar({ filters, more }: { filters: ReturnType<typeof useFilters>; more?: boolean }) {
  const { lists, trades } = useJournal();
  const { state, set } = filters;
  const preset = PRESETS.find((p) => {
    const [a, b] = p.range();
    return a === state.from && b === state.to;
  });
  const tags = [...new Set(trades.flatMap((t) => t.tags))].sort();
  const mistakes = [...new Set(trades.flatMap((t) => t.mistakes ?? []))].sort();
  const sel = cn(inputClass, "w-auto py-1.5 text-xs");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex overflow-hidden rounded-lg border border-border-strong">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => {
              const [from, to] = p.range();
              set({ from, to });
            }}
            className={cn("px-3 py-1.5 text-xs font-medium", preset?.key === p.key ? "bg-accent/20 text-accent" : "bg-surface-1 text-text-muted hover:text-text-primary")}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input type="date" aria-label="From" value={state.from} onChange={(e) => set({ from: e.target.value })} className={sel} />
      <span className="text-xs text-text-muted">to</span>
      <input type="date" aria-label="To" value={state.to} onChange={(e) => set({ to: e.target.value })} className={sel} />
      <select aria-label="Type" value={state.type} onChange={(e) => set({ type: e.target.value as AssetClass })} className={sel}>
        <option value="">All types</option>
        <option value="EQUITY">Stocks</option>
        <option value="OPTION">Options</option>
        <option value="FUTURE">Futures</option>
      </select>
      {lists.accounts.length > 1 && (
        <select aria-label="Account" value={state.account} onChange={(e) => set({ account: e.target.value })} className={sel}>
          <option value="">All accounts</option>
          {lists.accounts.map((a) => <option key={a}>{a}</option>)}
        </select>
      )}
      {more && (
        <>
          <input placeholder="Symbol" aria-label="Symbol" value={state.symbol} onChange={(e) => set({ symbol: e.target.value })} className={cn(sel, "w-24")} />
          <select aria-label="Status" value={state.status} onChange={(e) => set({ status: e.target.value })} className={sel}>
            <option value="">Open & closed</option>
            <option value="OPEN">Open only</option>
            <option value="CLOSED">Closed only</option>
          </select>
          {lists.strategies.length > 0 && (
            <select aria-label="Strategy" value={state.strategy} onChange={(e) => set({ strategy: e.target.value })} className={sel}>
              <option value="">All strategies</option>
              {lists.strategies.map((s) => <option key={s}>{s}</option>)}
            </select>
          )}
          {mistakes.length > 0 && (
            <select aria-label="Mistake" value={state.mistake} onChange={(e) => set({ mistake: e.target.value })} className={sel}>
              <option value="">Any mistake</option>
              {mistakes.map((s) => <option key={s}>{s}</option>)}
            </select>
          )}
          {tags.length > 0 && (
            <select aria-label="Tag" value={state.tag} onChange={(e) => set({ tag: e.target.value })} className={sel}>
              <option value="">All tags</option>
              {tags.map((s) => <option key={s}>{s}</option>)}
            </select>
          )}
        </>
      )}
      {filters.active && (
        <button type="button" onClick={filters.clear} className="px-2 text-xs text-text-muted underline-offset-4 hover:text-text-primary hover:underline">
          Clear
        </button>
      )}
    </div>
  );
}
