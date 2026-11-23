import { useNavigate } from "react-router";
import { ASSET_LABEL, contractLabel, sideLabel, QTY_UNIT, type TradeRow } from "../lib/calc";
import { dateLabel, price, qty } from "../lib/format";
import { Badge, Pnl } from "./ui";

export function TradesTable({ rows }: { rows: TradeRow[] }) {
  const nav = useNavigate();
  if (!rows.length) return <div className="py-10 text-center text-sm text-text-muted">No trades to show.</div>;
  const sorted = [...rows].sort((a, b) => (b.s.entryDate ?? "").localeCompare(a.s.entryDate ?? ""));
  return (
    <>
      {/* Phones: simple cards */}
      <ul className="divide-y divide-border-strong md:hidden">
        {sorted.map(({ trade: t, s }) => (
          <li key={t.id}>
            <button type="button" onClick={() => nav(`/trades/${t.id}`)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold">{contractLabel(t)}</span>
                  {s.status === "OPEN" && <Badge tone="warn">Open</Badge>}
                </div>
                <div className="mt-0.5 text-xs text-text-muted">
                  {ASSET_LABEL[t.assetClass]} · {sideLabel(t)} · {dateLabel(s.entryDate?.slice(0, 10) ?? null)}
                </div>
              </div>
              <Pnl value={s.pnl} />
            </button>
          </li>
        ))}
      </ul>

      {/* Larger screens: full table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-strong text-left text-xs text-text-muted">
              {["Date", "What", "Type", "Side", "Size", "Entry", "Exit", "Result", ""].map((h, i) => (
                <th key={i} className={`py-2 pr-4 font-medium ${i >= 4 && i <= 7 ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ trade: t, s }) => (
              <tr key={t.id} onClick={() => nav(`/trades/${t.id}`)} className="cursor-pointer border-b border-border-strong/60 hover:bg-surface-2">
                <td className="whitespace-nowrap py-2.5 pr-4 text-text-secondary">{dateLabel(s.entryDate?.slice(0, 10) ?? null)}</td>
                <td className="py-2.5 pr-4 font-semibold">{contractLabel(t)}</td>
                <td className="py-2.5 pr-4 text-text-secondary">{ASSET_LABEL[t.assetClass]}</td>
                <td className="py-2.5 pr-4"><Badge tone={t.side === "LONG" ? "good" : "bad"}>{sideLabel(t)}</Badge></td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-text-secondary">{qty(s.entryQty)} {QTY_UNIT[t.assetClass]}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-text-secondary">{price(s.avgEntry)}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-text-secondary">{price(s.avgExit)}</td>
                <td className="py-2.5 pr-4 text-right"><Pnl value={s.pnl} /></td>
                <td className="py-2.5 text-right">{s.status === "OPEN" && <Badge tone="warn">Open</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
