import { Fragment, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Plus, FileSpreadsheet, Loader2, ChevronLeft, ChevronRight, NotebookPen } from "lucide-react";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, format, addMonths } from "date-fns";
import { useJournal } from "../lib/journal";
import { computeStats, equityCurve, pnlByAsset, pnlBySymbol, pnlByStrategy, pnlByWeekday, pnlByTag, dailyPnl, type TradeRow } from "../lib/calc";
import { cn, money, signedMoney, num } from "../lib/format";
import { Button, Card, Empty, PageHeader, StatCard } from "../components/ui";
import { EquityChart, BucketChart, WinDonut } from "../components/Charts";
import { TradesTable } from "../components/TradesTable";
import { FilterBar, useFilters } from "../components/Filters";
import { downloadExcel } from "../lib/excel";
import { TodayCard, MistakesCard, TimeOfDayCard } from "../components/Insights";
import { ShareResultsButton } from "../components/Share";

function NoTradesYet() {
  return (
    <Empty
      icon={<NotebookPen size={36} />}
      title="Your journal is empty"
      action={
        <Link to="/trades/new"><Button variant="primary" size="lg"><Plus size={18} /> Log your first trade</Button></Link>
      }
    >
      Click below to log a trade. It takes less than a minute.
    </Empty>
  );
}

export function ExcelButton({ rows, label = "Export to Excel" }: { rows: TradeRow[]; label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      disabled={busy || !rows.length}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadExcel(rows, `trade-journal-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} {label}
    </Button>
  );
}

export function Dashboard() {
  const { rows } = useJournal();
  const filters = useFilters();
  if (!rows.length) return (<><PageHeader title="Dashboard" /><NoTradesYet /></>);
  const list = filters.apply(rows);
  const st = computeStats(list);
  const pf = st.profitFactor === null ? "—" : st.profitFactor === Infinity ? "No losses" : num(st.profitFactor.toFixed(2));
  const types = new Set(list.map((r) => r.trade.assetClass));

  return (
    <>
      <PageHeader title="Dashboard" sub="How your trading is going." action={<><ShareResultsButton rows={rows} /><ExcelButton rows={list} /></>} />
      <div className="space-y-5 px-4 py-5 md:px-8">
        <TodayCard rows={rows} />
        <FilterBar filters={filters} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Net P&L" value={signedMoney(st.totalPnl)} tone={st.totalPnl > 0 ? "good" : st.totalPnl < 0 ? "bad" : undefined} sub={`${st.closed} closed · ${st.open} open`} />
          <StatCard label="Win rate" value={num(`${st.winRate.toFixed(1)}%`)} sub={`${st.wins} win${st.wins === 1 ? "" : "s"} · ${st.losses} loss${st.losses === 1 ? "" : "es"}`} />
          <StatCard label="Avg win / Avg loss" value={money(st.avgWin)} sub={`${money(-st.avgLoss)} avg loss`} />
          <StatCard label="Profit factor" value={pf} sub="Money won ÷ money lost" />
          <StatCard label="Avg per trade" value={signedMoney(st.expectancy)} tone={st.expectancy > 0 ? "good" : st.expectancy < 0 ? "bad" : undefined} />
          <StatCard label="Best / Worst" value={signedMoney(st.best)} sub={`${signedMoney(st.worst)} worst`} />
          <StatCard label="Avg R-multiple" value={st.avgR === null ? "—" : num(`${st.avgR}R`)} sub={st.avgR === null ? "Add a stop loss to see this" : "Result ÷ planned risk"} />
          <StatCard
            label="Current streak"
            value={st.streak.type === "none" ? "—" : `${st.streak.count} ${st.streak.type === "win" ? "win" : "loss"}${st.streak.count > 1 ? (st.streak.type === "win" ? "s" : "es") : ""}`}
            tone={st.streak.type === "win" ? "good" : st.streak.type === "loss" ? "bad" : undefined}
            sub={`${money(st.fees)} total fees`}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card title="Account growth" className="xl:col-span-2"><EquityChart data={equityCurve(list)} /></Card>
          <Card title="Wins vs. losses"><WinDonut wins={st.wins} losses={st.losses} breakeven={st.breakeven} /></Card>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {types.size > 1 && <Card title="By type"><BucketChart data={pnlByAsset(list)} /></Card>}
          <Card title="By symbol"><BucketChart data={pnlBySymbol(list)} /></Card>
          <Card title="By day of week"><BucketChart data={pnlByWeekday(list)} /></Card>
          {list.some((r) => r.trade.strategy) && <Card title="By strategy"><BucketChart data={pnlByStrategy(list)} /></Card>}
          {list.some((r) => r.trade.tags.length) && <Card title="By tag"><BucketChart data={pnlByTag(list)} /></Card>}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <TimeOfDayCard rows={list} />
          <MistakesCard rows={list} />
        </div>
        <Card title={filters.active ? "Trades in this view" : "Latest trades"} action={<Link to="/trades" className="text-xs font-medium text-accent hover:underline">See all</Link>}>
          <TradesTable rows={filters.active ? list : [...list].sort((a, b) => (b.s.entryDate ?? "").localeCompare(a.s.entryDate ?? "")).slice(0, 8)} />
        </Card>
      </div>
    </>
  );
}

export function Trades() {
  const { rows } = useJournal();
  const filters = useFilters();
  if (!rows.length) return (<><PageHeader title="Trades" /><NoTradesYet /></>);
  const list = filters.apply(rows);
  const st = computeStats(list);
  return (
    <>
      <PageHeader
        title="Trades"
        sub={`${list.length} trade${list.length === 1 ? "" : "s"} · ${signedMoney(st.totalPnl)} net`}
        action={<><ExcelButton rows={list} /><Link to="/trades/new"><Button variant="primary"><Plus size={16} /> Log a Trade</Button></Link></>}
      />
      <div className="space-y-4 px-4 py-5 md:px-8">
        <FilterBar filters={filters} more />
        <Card><TradesTable rows={list} /></Card>
      </div>
    </>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function Calendar() {
  const { rows } = useJournal();
  const filters = useFilters();
  const nav = useNavigate();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const list = filters.apply(rows);
  const daily = dailyPnl(list);

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  // Hide Sat/Sun columns unless there's weekend trading (futures/crypto) this month.
  const weekend = days.some((d) => (d.getDay() === 0 || d.getDay() === 6) && daily.has(format(d, "yyyy-MM-dd")));
  const cols = weekend ? 7 : 5;

  let monthPnl = 0, monthTrades = 0, greenDays = 0, redDays = 0;
  for (const d of days) {
    if (!isSameMonth(d, month)) continue;
    const s = daily.get(format(d, "yyyy-MM-dd"));
    if (!s) continue;
    monthPnl += s.pnl;
    monthTrades += s.trades;
    if (s.pnl > 0) greenDays++;
    else if (s.pnl < 0) redDays++;
  }

  return (
    <>
      <PageHeader
        title="Calendar"
        sub={<>Each day shows what you made or lost on trades you closed that day.</>}
        action={
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft size={16} /></Button>
            <span className="min-w-32 text-center text-sm font-semibold">{format(month, "MMMM yyyy")}</span>
            <Button size="sm" variant="ghost" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month"><ChevronRight size={16} /></Button>
            <Button size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button>
          </div>
        }
      />
      <div className="space-y-4 px-4 py-5 md:px-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="This month" value={signedMoney(Math.round(monthPnl * 100) / 100)} tone={monthPnl > 0 ? "good" : monthPnl < 0 ? "bad" : undefined} />
          <StatCard label="Trades closed" value={String(monthTrades)} />
          <StatCard label="Green days" value={String(greenDays)} tone="good" />
          <StatCard label="Red days" value={String(redDays)} tone={redDays ? "bad" : undefined} />
        </div>
        <div className="overflow-x-auto">
          <div className="grid min-w-[640px] gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr)) 110px` }}>
            {WEEKDAYS.slice(0, cols).map((d) => <div key={d} className="px-1 text-xs font-medium text-text-muted">{d}</div>)}
            <div className="px-1 text-xs font-medium text-text-muted">Week</div>
            {weeks.map((week) => {
              let wp = 0, wt = 0;
              const cells = week.slice(0, cols).map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const s = daily.get(key);
                if (s) { wp += s.pnl; wt += s.trades; }
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => s && nav(`/trades?from=${key}&to=${key}`)}
                    className={cn(
                      "flex min-h-[84px] flex-col justify-between rounded-lg border border-border-strong p-2 text-left",
                      !isSameMonth(day, month) && "opacity-35",
                      s && s.pnl > 0 && "bg-good/10 hover:bg-good/20",
                      s && s.pnl < 0 && "bg-critical/10 hover:bg-critical/20",
                      !s && "cursor-default",
                      isToday(day) && "ring-1 ring-accent"
                    )}
                  >
                    <span className={cn("text-xs", isToday(day) ? "font-semibold text-accent" : "text-text-muted")}>{format(day, "d")}</span>
                    {s && (
                      <span>
                        <span className={cn("block text-sm font-semibold tabular-nums", s.pnl > 0 ? "text-good-text" : s.pnl < 0 ? "text-critical-text" : "text-text-secondary")}>{signedMoney(s.pnl)}</span>
                        <span className="block text-[11px] text-text-muted">{s.trades} trade{s.trades === 1 ? "" : "s"}</span>
                      </span>
                    )}
                  </button>
                );
              });
              return (
                <Fragment key={format(week[0], "yyyy-MM-dd")}>
                  {cells}
                  <div className="flex min-h-[84px] flex-col justify-center rounded-lg border border-border-strong bg-surface-2 p-2">
                    {wt ? (
                      <>
                        <span className={cn("text-sm font-semibold tabular-nums", wp > 0 ? "text-good-text" : wp < 0 ? "text-critical-text" : "")}>{signedMoney(Math.round(wp * 100) / 100)}</span>
                        <span className="text-[11px] text-text-muted">{wt} trades</span>
                      </>
                    ) : <span className="text-xs text-text-muted">—</span>}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
