import type { SheetData, Cell } from "write-excel-file/universal";
import { ASSET_LABEL, computeStats, contractLabel, dailyPnl, sideLabel, type TradeRow } from "./calc";

const MONEY = '"$"#,##0.00;[Red]-"$"#,##0.00';
const NUM = "#,##0.####";

/** Excel stores dates without a time zone; build them from the member's local clock so nothing shifts a day. */
function xlDate(s: string | null): Date | null {
  if (!s) return null;
  const [d, t] = s.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = (t ?? "00:00").split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, day, hh || 0, mm || 0));
}

const head = (v: string): Cell => ({ value: v, fontWeight: "bold", backgroundColor: "#E8EEF7" });
const money = (v: number | null): Cell => (v === null ? null : { value: v, type: Number, format: MONEY });
const num = (v: number | null): Cell => (v === null ? null : { value: v, type: Number, format: NUM });
const text = (v: string | null | undefined): Cell => (v ? { value: v, type: String } : null);
const date = (v: string | null): Cell => {
  const d = xlDate(v);
  if (!d) return null;
  return { value: d, type: Date, format: v && v.length > 10 ? "mm/dd/yyyy h:mm AM/PM" : "mm/dd/yyyy" };
};

export function buildWorkbook(list: TradeRow[]) {
  const sorted = [...list].sort((a, b) => (b.s.entryDate ?? "").localeCompare(a.s.entryDate ?? ""));

  const tradeCols = [
    "Opened", "Closed", "Type", "Symbol", "Contract", "Side", "Quantity", "Avg Entry", "Avg Exit", "Fees",
    "Net P&L", "Return %", "R-Multiple", "Points", "Ticks", "Status", "Stop Loss", "Target",
    "Option Type", "Strike", "Expiration", "Multiplier", "Futures Month", "Point Value",
    "Account", "Strategy", "Tags", "Mistakes", "Grade", "Notes",
  ];
  const trades: SheetData = [
    tradeCols.map(head),
    ...sorted.map(({ trade: t, s }) => [
      date(s.entryDate),
      date(s.exitDate),
      text(ASSET_LABEL[t.assetClass]),
      text(t.symbol),
      text(contractLabel(t)),
      text(sideLabel(t)),
      num(s.entryQty),
      num(s.avgEntry),
      num(s.avgExit),
      money(t.fees),
      money(s.pnl),
      s.returnPct === null ? null : { value: s.returnPct / 100, type: Number, format: "0.0%" },
      num(s.rMultiple),
      t.assetClass === "FUTURE" ? num(s.pointsPerUnit) : null,
      num(s.ticks),
      text(s.status === "OPEN" ? "Open" : "Closed"),
      num(t.stopLoss),
      num(t.target),
      text(t.option?.structure === "SPREAD" ? "Spread" : t.option?.type === "CALL" ? "Call" : t.option?.type === "PUT" ? "Put" : ""),
      num(t.option?.strike ?? null),
      date(t.option?.expiration || null),
      t.assetClass === "OPTION" ? num(t.option?.multiplier ?? null) : null,
      text(t.future?.contractMonth),
      t.assetClass === "FUTURE" ? money(t.future?.pointValue ?? null) : null,
      text(t.account),
      text(t.strategy),
      text(t.tags.join(", ")),
      text((t.mistakes ?? []).join(", ")),
      text(t.grade),
      text(t.notes),
    ]),
  ];

  const fills: SheetData = [
    ["Date", "Symbol", "Contract", "Type", "Action", "Price", "Quantity"].map(head),
    ...sorted.flatMap(({ trade: t }) => {
      const openWord = t.side === "LONG" ? "Buy" : "Sell";
      const closeWord = t.side === "LONG" ? "Sell" : "Buy";
      return [
        ...t.entries.map((f) => ({ f, action: `${openWord} (open)` })),
        ...t.exits.map((f) => ({ f, action: `${closeWord} (close)` })),
      ]
        .sort((a, b) => a.f.date.localeCompare(b.f.date))
        .map(({ f, action }) => [
          date(f.date), text(t.symbol), text(contractLabel(t)), text(ASSET_LABEL[t.assetClass]), text(action), num(f.price), num(f.quantity),
        ]);
    }),
  ];

  const st = computeStats(list);
  const summary: SheetData = [
    [head("Measure"), head("Value")],
    [text("Total trades"), num(st.total)],
    [text("Closed trades"), num(st.closed)],
    [text("Open trades"), num(st.open)],
    [text("Net P&L"), money(st.totalPnl)],
    [text("Win rate"), { value: st.winRate / 100, type: Number, format: "0.0%" }],
    [text("Wins / Losses"), text(`${st.wins} / ${st.losses}`)],
    [text("Average win"), money(st.avgWin)],
    [text("Average loss"), money(-st.avgLoss)],
    [text("Profit factor"), st.profitFactor === null ? null : st.profitFactor === Infinity ? text("No losses") : num(Math.round(st.profitFactor * 100) / 100)],
    [text("Expectancy (avg per trade)"), money(st.expectancy)],
    [text("Best trade"), money(st.best)],
    [text("Worst trade"), money(st.worst)],
    [text("Average R-multiple"), num(st.avgR)],
    [text("Total fees"), money(st.fees)],
  ];

  const days = dailyPnl(list);
  const daily: SheetData = [
    ["Date", "Trades", "Wins", "Losses", "Net P&L"].map(head),
    ...[...days.keys()].sort().reverse().map((k) => {
      const d = days.get(k)!;
      return [date(k), num(d.trades), num(d.wins), num(d.losses), money(d.pnl)];
    }),
  ];

  const w = (n: number) => ({ width: n });
  return [
    { data: trades, sheet: "Trades", stickyRowsCount: 1, columns: tradeCols.map((c) => w(c === "Notes" ? 50 : c === "Contract" ? 24 : c.length > 10 ? 14 : 12)) },
    { data: fills, sheet: "Fills", stickyRowsCount: 1, columns: [w(20), w(10), w(24), w(10), w(14), w(12), w(10)] },
    { data: summary, sheet: "Summary", columns: [w(28), w(16)] },
    { data: daily, sheet: "Daily P&L", stickyRowsCount: 1, columns: [w(14), w(10), w(10), w(10), w(14)] },
  ];
}

export async function downloadExcel(list: TradeRow[], fileName: string) {
  const { default: writeXlsxFile } = await import("write-excel-file/universal");
  const blob = await writeXlsxFile(buildWorkbook(list)).toBlob();
  downloadBlob(blob, fileName);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
