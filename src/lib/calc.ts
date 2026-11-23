import type { Trade, Fill, AssetClass } from "./types";

/** How many dollars one unit of price movement is worth, per 1 quantity. */
export function multiplierOf(t: Pick<Trade, "assetClass" | "option" | "future">): number {
  if (t.assetClass === "OPTION") return t.option?.multiplier || 100;
  if (t.assetClass === "FUTURE") return t.future?.pointValue || 1;
  return 1;
}

export const QTY_LABEL: Record<AssetClass, string> = { EQUITY: "Shares", OPTION: "Contracts", FUTURE: "Contracts" };
export const QTY_UNIT: Record<AssetClass, string> = { EQUITY: "sh", OPTION: "ct", FUTURE: "ct" };
export const ASSET_LABEL: Record<AssetClass, string> = { EQUITY: "Stock", OPTION: "Option", FUTURE: "Future" };

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function avgPrice(fills: Fill[]): number | null {
  const qty = fills.reduce((s, f) => s + f.quantity, 0);
  if (!qty) return null;
  return fills.reduce((s, f) => s + f.price * f.quantity, 0) / qty;
}

export type Summary = {
  status: "OPEN" | "CLOSED";
  entryDate: string | null;
  exitDate: string | null;
  entryQty: number;
  exitQty: number;
  openQty: number;
  avgEntry: number | null;
  avgExit: number | null;
  /** Realized net P&L on the closed quantity, after fees. null until something is closed. */
  pnl: number | null;
  grossPnl: number | null;
  /** Price move captured per unit, signed in the trade's favor (futures: points). */
  pointsPerUnit: number | null;
  ticks: number | null; // futures only
  /** Return on the money put in (cost basis of the closed quantity). Not shown for futures/short options. */
  returnPct: number | null;
  /** P&L divided by planned risk (needs a stop loss). */
  rMultiple: number | null;
  holdMinutes: number | null;
  daysToExpiration: number | null; // options only, at first entry
};

export function parseLocal(date: string): Date {
  // "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm" read as local time (never UTC), so calendars match the member's day.
  const [d, t] = date.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = (t ?? "00:00").split(":").map(Number);
  return new Date(y, (m || 1) - 1, day || 1, hh || 0, mm || 0);
}

export function summarize(t: Trade): Summary {
  const entryQty = t.entries.reduce((s, f) => s + f.quantity, 0);
  const exitQty = t.exits.reduce((s, f) => s + f.quantity, 0);
  const avgEntry = avgPrice(t.entries);
  const avgExit = avgPrice(t.exits);
  const sortedDates = (fills: Fill[]) => fills.map((f) => f.date).filter(Boolean).sort();
  const entryDates = sortedDates(t.entries);
  const exitDates = sortedDates(t.exits);
  const entryDate = entryDates[0] ?? null;
  const exitDate = exitDates.length ? exitDates[exitDates.length - 1] : null;
  const status = entryQty > 0 && exitQty >= entryQty ? "CLOSED" : "OPEN";
  const closedQty = Math.min(entryQty, exitQty);
  const mult = multiplierOf(t);
  const dir = t.side === "LONG" ? 1 : -1;

  let pnl: number | null = null;
  let grossPnl: number | null = null;
  let pointsPerUnit: number | null = null;
  if (closedQty > 0 && avgEntry !== null && avgExit !== null) {
    pointsPerUnit = (avgExit - avgEntry) * dir;
    grossPnl = round(pointsPerUnit * closedQty * mult);
    pnl = round(grossPnl - (t.fees || 0));
  }

  const ticks =
    t.assetClass === "FUTURE" && pointsPerUnit !== null && t.future?.tickSize
      ? round(pointsPerUnit / t.future.tickSize, 1)
      : null;

  // Return % only where "money put in" is clear: stocks, and options you bought.
  let returnPct: number | null = null;
  const canReturn = t.assetClass === "EQUITY" || (t.assetClass === "OPTION" && t.side === "LONG");
  if (canReturn && pnl !== null && avgEntry) {
    const basis = avgEntry * closedQty * mult;
    if (basis > 0) returnPct = round((pnl / basis) * 100, 1);
  }

  let rMultiple: number | null = null;
  if (pnl !== null && t.stopLoss !== null && avgEntry !== null) {
    const riskPerUnit = Math.abs(avgEntry - t.stopLoss);
    const risk = riskPerUnit * closedQty * mult;
    if (risk > 0) rMultiple = round(pnl / risk, 2);
  }

  const holdMinutes =
    status === "CLOSED" && entryDate && exitDate
      ? Math.max(0, Math.round((parseLocal(exitDate).getTime() - parseLocal(entryDate).getTime()) / 60000))
      : null;

  let daysToExpiration: number | null = null;
  if (t.assetClass === "OPTION" && t.option?.expiration && entryDate) {
    const exp = parseLocal(t.option.expiration);
    const start = parseLocal(entryDate.slice(0, 10));
    daysToExpiration = Math.round((exp.getTime() - start.getTime()) / 864e5);
  }

  return {
    status,
    entryDate,
    exitDate,
    entryQty,
    exitQty,
    openQty: Math.max(0, entryQty - exitQty),
    avgEntry,
    avgExit,
    pnl,
    grossPnl,
    pointsPerUnit,
    ticks,
    returnPct,
    rMultiple,
    holdMinutes,
    daysToExpiration,
  };
}

/** Human description of exactly what was traded, e.g. "SPY 550C 12/19/26" or "ES Dec 2026". */
export function contractLabel(t: Trade): string {
  if (t.assetClass === "OPTION" && t.option) {
    const exp = t.option.expiration ? shortDate(t.option.expiration) : "";
    if (t.option.structure === "SPREAD") {
      return [t.symbol, t.option.spreadName || "Spread", exp].filter(Boolean).join(" ");
    }
    const strike = t.option.strike !== null ? trimNum(t.option.strike) : "";
    const type = t.option.type === "CALL" ? "C" : t.option.type === "PUT" ? "P" : "";
    return [t.symbol, `${strike}${type}`, exp].filter(Boolean).join(" ");
  }
  if (t.assetClass === "FUTURE" && t.future?.contractMonth) {
    const [y, m] = t.future.contractMonth.split("-").map(Number);
    const mon = new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short" });
    return `${t.symbol} ${mon} ${y}`;
  }
  return t.symbol;
}

export function sideLabel(t: Pick<Trade, "assetClass" | "side">): string {
  if (t.assetClass === "OPTION") return t.side === "LONG" ? "Bought" : "Sold";
  return t.side === "LONG" ? "Long" : "Short";
}

function shortDate(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
}

export function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(round(n, 6));
}

// ---------- Stats across many trades ----------

export type TradeRow = { trade: Trade; s: Summary };

export function rows(trades: Trade[]): TradeRow[] {
  return trades.map((trade) => ({ trade, s: summarize(trade) }));
}

const closedOf = (r: TradeRow[]) => r.filter((x) => x.s.status === "CLOSED" && x.s.pnl !== null);
/** The day a trade "counts" on — when it was closed. */
export const tradeDay = (r: TradeRow) => (r.s.exitDate ?? r.s.entryDate ?? "").slice(0, 10);

export type Stats = {
  total: number;
  closed: number;
  open: number;
  totalPnl: number;
  winRate: number;
  wins: number;
  losses: number;
  breakeven: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number | null;
  expectancy: number;
  best: number;
  worst: number;
  avgR: number | null;
  fees: number;
  streak: { type: "win" | "loss" | "none"; count: number };
};

export function computeStats(all: TradeRow[]): Stats {
  const closed = closedOf(all);
  const p = (r: TradeRow) => r.s.pnl ?? 0;
  const wins = closed.filter((r) => p(r) > 0);
  const losses = closed.filter((r) => p(r) < 0);
  const grossProfit = wins.reduce((s, r) => s + p(r), 0);
  const grossLoss = Math.abs(losses.reduce((s, r) => s + p(r), 0));
  const totalPnl = round(closed.reduce((s, r) => s + p(r), 0));
  const values = closed.map(p);
  const rs = closed.map((r) => r.s.rMultiple).filter((x): x is number => x !== null);

  const chrono = [...closed].sort((a, b) => (a.s.exitDate ?? "").localeCompare(b.s.exitDate ?? "") || (a.trade.createdAt ?? "").localeCompare(b.trade.createdAt ?? ""));
  let streak: Stats["streak"] = { type: "none", count: 0 };
  for (let i = chrono.length - 1; i >= 0; i--) {
    const v = p(chrono[i]);
    if (v === 0) continue;
    const type = v > 0 ? "win" : "loss";
    if (streak.type === "none") streak = { type, count: 1 };
    else if (streak.type === type) streak.count++;
    else break;
  }

  return {
    total: all.length,
    closed: closed.length,
    open: all.length - closed.length,
    totalPnl,
    winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
    wins: wins.length,
    losses: losses.length,
    breakeven: closed.length - wins.length - losses.length,
    avgWin: wins.length ? grossProfit / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null,
    expectancy: closed.length ? totalPnl / closed.length : 0,
    best: values.length ? Math.max(...values) : 0,
    worst: values.length ? Math.min(...values) : 0,
    avgR: rs.length ? round(rs.reduce((a, b) => a + b, 0) / rs.length, 2) : null,
    fees: round(all.reduce((s, r) => s + (r.trade.fees || 0), 0)),
    streak,
  };
}

export type EquityPoint = { date: string; cumPnl: number };

export function equityCurve(all: TradeRow[]): EquityPoint[] {
  const byDay = dailyPnl(all);
  let cum = 0;
  const days = [...byDay.keys()].sort();
  if (!days.length) return [];
  // Start the line at $0 the day before the first close, so even one day draws a line.
  const first = parseLocal(days[0]);
  first.setDate(first.getDate() - 1);
  const p = (n: number) => String(n).padStart(2, "0");
  const start = `${first.getFullYear()}-${p(first.getMonth() + 1)}-${p(first.getDate())}`;
  return [
    { date: start, cumPnl: 0 },
    ...days.map((date) => {
      cum = round(cum + byDay.get(date)!.pnl);
      return { date, cumPnl: cum };
    }),
  ];
}

export type Bucket = { key: string; pnl: number; trades: number; wins: number };

function bucket(all: TradeRow[], keys: (r: TradeRow) => string[]): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const r of closedOf(all)) {
    for (const key of keys(r)) {
      const b = map.get(key) ?? { key, pnl: 0, trades: 0, wins: 0 };
      b.pnl = round(b.pnl + (r.s.pnl ?? 0));
      b.trades++;
      if ((r.s.pnl ?? 0) > 0) b.wins++;
      map.set(key, b);
    }
  }
  return [...map.values()];
}

const byAbs = (a: Bucket, b: Bucket) => Math.abs(b.pnl) - Math.abs(a.pnl);
export const pnlBySymbol = (r: TradeRow[], limit = 8) => bucket(r, (x) => [x.trade.symbol]).sort(byAbs).slice(0, limit);
export const pnlByStrategy = (r: TradeRow[]) => bucket(r, (x) => [x.trade.strategy || "No strategy"]).sort(byAbs);
export const pnlByTag = (r: TradeRow[]) => bucket(r, (x) => x.trade.tags).sort(byAbs).slice(0, 10);
export const pnlByAsset = (r: TradeRow[]) =>
  bucket(r, (x) => [ASSET_LABEL[x.trade.assetClass] + "s"]).sort((a, b) => a.key.localeCompare(b.key));

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function pnlByWeekday(r: TradeRow[]): Bucket[] {
  const b = bucket(r, (x) => [DOW[parseLocal(tradeDay(x)).getDay()]]);
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const extra = b.filter((x) => !order.includes(x.key)); // weekend futures/crypto sessions
  return [...order.map((d) => b.find((x) => x.key === d) ?? { key: d, pnl: 0, trades: 0, wins: 0 }), ...extra];
}

export type DayTotal = { pnl: number; trades: number; wins: number; losses: number };

export function dailyPnl(all: TradeRow[]): Map<string, DayTotal> {
  const map = new Map<string, DayTotal>();
  for (const r of closedOf(all)) {
    const key = tradeDay(r);
    const d = map.get(key) ?? { pnl: 0, trades: 0, wins: 0, losses: 0 };
    d.pnl = round(d.pnl + (r.s.pnl ?? 0));
    d.trades++;
    if ((r.s.pnl ?? 0) > 0) d.wins++;
    else if ((r.s.pnl ?? 0) < 0) d.losses++;
    map.set(key, d);
  }
  return map;
}

// ---------- Mistakes: what they cost ----------

export type MistakeRow = { key: string; trades: number; pnl: number; lost: number };
export type MistakeStats = {
  /** Closed trades with no mistakes tagged. */
  clean: { trades: number; pnl: number };
  /** Closed trades with at least one mistake tagged. */
  withMistakes: { trades: number; pnl: number; lost: number };
  /** One row per mistake, most costly first. A trade with two mistakes counts toward both. */
  byMistake: MistakeRow[];
};

export function mistakeStats(all: TradeRow[]): MistakeStats {
  const closed = closedOf(all);
  const clean = { trades: 0, pnl: 0 };
  const withMistakes = { trades: 0, pnl: 0, lost: 0 };
  const map = new Map<string, MistakeRow>();
  for (const r of closed) {
    const p = r.s.pnl ?? 0;
    const ms = r.trade.mistakes ?? [];
    if (!ms.length) {
      clean.trades++;
      clean.pnl = round(clean.pnl + p);
      continue;
    }
    withMistakes.trades++;
    withMistakes.pnl = round(withMistakes.pnl + p);
    if (p < 0) withMistakes.lost = round(withMistakes.lost + p);
    for (const m of new Set(ms)) {
      const row = map.get(m) ?? { key: m, trades: 0, pnl: 0, lost: 0 };
      row.trades++;
      row.pnl = round(row.pnl + p);
      if (p < 0) row.lost = round(row.lost + p);
      map.set(m, row);
    }
  }
  const byMistake = [...map.values()].sort((a, b) => a.pnl - b.pnl || b.trades - a.trades);
  return { clean, withMistakes, byMistake };
}

// ---------- Time of day (when the trade was opened) ----------

export type TimeBucket = Bucket & { minutes: number };

/** 30-minute buckets by the first entry's time. Trades logged without a time are left out. */
export function pnlByTimeOfDay(all: TradeRow[]): TimeBucket[] {
  const map = new Map<number, TimeBucket>();
  for (const r of closedOf(all)) {
    const first = [...r.trade.entries].map((f) => f.date).sort()[0];
    if (!first || first.length <= 10) continue;
    const [hh, mm] = first.slice(11, 16).split(":").map(Number);
    const minutes = hh * 60 + Math.floor(mm / 30) * 30;
    const b = map.get(minutes) ?? { key: timeLabel(minutes), minutes, pnl: 0, trades: 0, wins: 0 };
    b.pnl = round(b.pnl + (r.s.pnl ?? 0));
    b.trades++;
    if ((r.s.pnl ?? 0) > 0) b.wins++;
    map.set(minutes, b);
  }
  return [...map.values()].sort((a, b) => a.minutes - b.minutes);
}

export function timeLabel(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}${h < 12 ? "a" : "p"}`;
}

/** "9:30–10:00 AM" style range for a 30-minute bucket. */
export function timeRangeLabel(minutes: number): string {
  const fmt = (x: number) => {
    const h = Math.floor(x / 60) % 24;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(x % 60).padStart(2, "0")}`;
  };
  const end = minutes + 30;
  return `${fmt(minutes)}–${fmt(end)} ${Math.floor(end / 60) % 24 < 12 ? "AM" : "PM"}`;
}

// ---------- Daily loss limit / profit goal ----------

export type DayLimit = {
  pnl: number;
  lossLimit: number | null;
  goal: number | null;
  /** 0–1 share of the loss limit used up (only counts losses). */
  lossUsed: number | null;
  /** 0–1 progress toward the goal. */
  goalProgress: number | null;
  state: "none" | "ok" | "near-limit" | "limit-hit" | "goal-hit";
};

export function dayLimitStatus(pnl: number, lossLimit: number | null, goal: number | null): DayLimit {
  const L = lossLimit && lossLimit > 0 ? lossLimit : null;
  const G = goal && goal > 0 ? goal : null;
  const lossUsed = L === null ? null : Math.min(1, Math.max(0, -pnl) / L);
  const goalProgress = G === null ? null : Math.min(1, Math.max(0, pnl) / G);
  let state: DayLimit["state"] = L === null && G === null ? "none" : "ok";
  if (L !== null && pnl <= -L) state = "limit-hit";
  else if (G !== null && pnl >= G) state = "goal-hit";
  else if (lossUsed !== null && lossUsed >= 0.75) state = "near-limit";
  return { pnl, lossLimit: L, goal: G, lossUsed, goalProgress, state };
}
