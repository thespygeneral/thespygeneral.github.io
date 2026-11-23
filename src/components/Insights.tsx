// Optional dashboard add-ons: Today (with optional daily limits), Mistakes, Time of day.
// Each one stands alone and shows a short invitation (or nothing) until the member uses it.

import { useState } from "react";
import { Link } from "react-router";
import { OctagonAlert, Trophy, Target, Settings2, ChevronRight } from "lucide-react";
import { useJournal } from "../lib/journal";
import { dailyPnl, dayLimitStatus, mistakeStats, pnlByTimeOfDay, timeRangeLabel, type TradeRow } from "../lib/calc";
import { cn, money, signedMoney, todayLocal } from "../lib/format";
import { Button, Card, Field, Modal, NumberInput, Pnl } from "./ui";
import { BucketChart } from "./Charts";

// ---------------- Today ----------------

export function TodayCard({ rows }: { rows: TradeRow[] }) {
  const { settings, saveSettings } = useJournal();
  const [editing, setEditing] = useState(false);
  const today = todayLocal();
  const taken = rows.filter((r) => r.trade.entries.some((f) => f.date.slice(0, 10) === today));
  const stillOpen = taken.filter((r) => r.s.status === "OPEN").length;
  const closed = dailyPnl(rows).get(today);
  const lim = dayLimitStatus(closed?.pnl ?? 0, settings.dailyLossLimit, settings.dailyProfitGoal);
  const label = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return (
    <section
      className={cn(
        "rounded-xl border px-4 py-4 md:px-5",
        lim.state === "limit-hit" ? "border-critical/50 bg-critical/10" : lim.state === "goal-hit" ? "border-good/40 bg-good/10" : "border-accent/30 bg-accent/5"
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-accent">Today · {label}</div>
          <Link to={`/trades?from=${today}&to=${today}`} className="group mt-1 inline-flex items-center gap-1 text-2xl font-semibold hover:underline">
            {taken.length} trade{taken.length === 1 ? "" : "s"} taken
            <ChevronRight size={18} className="text-text-muted group-hover:text-text-primary" />
          </Link>
        </div>
        <div className="flex gap-8 text-sm">
          <div>
            <div className="text-xs text-text-muted">Closed today</div>
            <div className="mt-0.5 font-semibold">{closed?.trades ?? 0}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">Still open</div>
            <div className="mt-0.5 font-semibold">{stillOpen}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">Today's P&L</div>
            <div className="mt-0.5"><Pnl value={closed ? closed.pnl : null} /></div>
          </div>
        </div>
      </div>

      {lim.state === "limit-hit" && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-critical/15 px-3 py-2.5 text-sm">
          <OctagonAlert size={17} className="mt-0.5 shrink-0 text-critical-text" />
          <span><b className="text-critical-text">Daily loss limit hit.</b> <span className="text-text-secondary">Your rule says stop trading for today. Tomorrow is a new day.</span></span>
        </div>
      )}
      {lim.state === "goal-hit" && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-good/15 px-3 py-2.5 text-sm">
          <Trophy size={17} className="mt-0.5 shrink-0 text-good-text" />
          <span><b className="text-good-text">Daily goal reached!</b> <span className="text-text-secondary">Consider protecting your gains and calling it a day.</span></span>
        </div>
      )}
      {lim.state === "near-limit" && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-warn/15 px-3 py-2.5 text-sm">
          <OctagonAlert size={17} className="mt-0.5 shrink-0 text-warn-text" />
          <span><b className="text-warn-text">Close to your daily loss limit.</b> <span className="text-text-secondary">Slow down and only take A+ setups.</span></span>
        </div>
      )}

      {lim.state === "none" ? (
        <button type="button" onClick={() => setEditing(true)} className="mt-3 inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary">
          <Target size={13} /> Set a daily loss limit or goal (optional)
        </button>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          {lim.lossLimit !== null ? (
            <Meter label="Loss limit used" value={lim.lossUsed ?? 0} tone="bad" detail={`${money(Math.max(0, -(closed?.pnl ?? 0)))} of ${money(lim.lossLimit)}`} />
          ) : <div className="hidden sm:block" />}
          {lim.goal !== null ? (
            <Meter label="Daily goal" value={lim.goalProgress ?? 0} tone="good" detail={`${money(Math.max(0, closed?.pnl ?? 0))} of ${money(lim.goal)}`} />
          ) : <div className="hidden sm:block" />}
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary">
            <Settings2 size={13} /> Change limits
          </button>
        </div>
      )}

      <Modal open={editing} onClose={() => setEditing(false)} title="Daily loss limit & goal">
        <LimitsForm
          loss={settings.dailyLossLimit}
          goal={settings.dailyProfitGoal}
          onSave={async (dailyLossLimit, dailyProfitGoal) => {
            await saveSettings({ ...settings, dailyLossLimit, dailyProfitGoal });
            setEditing(false);
          }}
        />
      </Modal>
    </section>
  );
}

function Meter({ label, value, tone, detail }: { label: string; value: number; tone: "good" | "bad"; detail: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between gap-2 text-xs">
        <span className="text-text-muted">{label}</span>
        <span className="tabular-nums text-text-secondary">{detail}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label={label} aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full", tone === "good" ? "bg-good" : "bg-critical")} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}

function LimitsForm({ loss, goal, onSave }: { loss: number | null; goal: number | null; onSave: (l: number | null, g: number | null) => Promise<void> }) {
  const [l, setL] = useState<number | null>(loss);
  const [g, setG] = useState<number | null>(goal);
  const clean = (v: number | null) => (v && v > 0 ? Math.abs(v) : null);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(clean(l), clean(g));
      }}
    >
      <p className="text-sm text-text-secondary">Both are optional. The Today card tracks them, and warns you when you hit your limit. Leave a box empty to turn it off.</p>
      <Field label="Max loss per day ($)" hint="Stop trading for the day when you've lost this much.">
        <NumberInput placeholder="e.g. 300" value={l} onChange={setL} min={0} />
      </Field>
      <Field label="Profit goal per day ($)" hint="A good day. Time to protect your gains.">
        <NumberInput placeholder="e.g. 500" value={g} onChange={setG} min={0} />
      </Field>
      <Button type="submit" variant="primary" className="w-full">Save</Button>
    </form>
  );
}

// ---------------- Mistakes ----------------

export function MistakesCard({ rows }: { rows: TradeRow[] }) {
  const m = mistakeStats(rows);
  if (m.clean.trades + m.withMistakes.trades === 0) return null; // no closed trades in this view
  if (!m.byMistake.length) {
    return (
      <Card title="What mistakes cost you">
        <p className="text-sm text-text-muted">
          When you log a trade, tap any mistakes you made (like FOMO or No stop). This card will then show exactly what each mistake costs you.
        </p>
      </Card>
    );
  }
  const worst = Math.max(...m.byMistake.map((r) => Math.abs(Math.min(0, r.pnl))), 1);
  return (
    <Card title="What mistakes cost you">
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-surface-2 px-3 py-2.5">
          <div className="text-xs text-text-muted">Trades with mistakes ({m.withMistakes.trades})</div>
          <Pnl value={m.withMistakes.pnl} className="text-lg" />
        </div>
        <div className="rounded-lg bg-surface-2 px-3 py-2.5">
          <div className="text-xs text-text-muted">Clean trades ({m.clean.trades})</div>
          <Pnl value={m.clean.pnl} className="text-lg" />
        </div>
      </div>
      <ul className="space-y-2.5">
        {m.byMistake.map((r) => (
          <li key={r.key}>
            <Link to={`/trades?mistake=${encodeURIComponent(r.key)}`} className="block rounded-md hover:bg-surface-2">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{r.key} <span className="text-xs font-normal text-text-muted">· {r.trades} trade{r.trades === 1 ? "" : "s"}</span></span>
                <Pnl value={r.pnl} />
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-critical" style={{ width: `${(Math.abs(Math.min(0, r.pnl)) / worst) * 100}%` }} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------------- Time of day ----------------

export function TimeOfDayCard({ rows }: { rows: TradeRow[] }) {
  const data = pnlByTimeOfDay(rows);
  if (data.length < 1) return null; // only trades logged without a time
  const best = [...data].sort((a, b) => b.pnl - a.pnl)[0];
  const worst = [...data].sort((a, b) => a.pnl - b.pnl)[0];
  return (
    <Card
      title="By time of day"
      action={<span className="text-xs text-text-muted">When you opened the trade</span>}
    >
      <BucketChart data={data} />
      {data.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {best.pnl > 0 && (
            <span><span className="text-text-muted">Best: </span><b className="text-good-text">{timeRangeLabel(best.minutes)}</b> <span className="text-text-muted">({signedMoney(best.pnl)})</span></span>
          )}
          {worst.pnl < 0 && (
            <span><span className="text-text-muted">Worst: </span><b className="text-critical-text">{timeRangeLabel(worst.minutes)}</b> <span className="text-text-muted">({signedMoney(worst.pnl)})</span></span>
          )}
        </div>
      )}
    </Card>
  );
}
