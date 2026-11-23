// "Share" buttons: make a branded image of one trade or of today / this week / this month.
// Optional extra — nothing else in the app depends on it.

import { useEffect, useMemo, useState } from "react";
import { Share2, Copy, Download, Check, Loader2 } from "lucide-react";
import { format, startOfWeek, startOfMonth, endOfWeek } from "date-fns";
import { ASSET_LABEL, computeStats, contractLabel, sideLabel, summarize, tradeDay, type TradeRow } from "../lib/calc";
import { holdLabel, numbersHidden, todayLocal } from "../lib/format";
import { renderCard, canvasToPng, type CardContent, type Stat } from "../lib/shareCard";
import { downloadBlob } from "../lib/excel";
import type { Trade } from "../lib/types";
import { Button, Modal, Segmented } from "./ui";
import { parseLocal } from "../lib/calc";

const priceRaw = (v: number | null) => (v === null ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 }));

function tradeContent(t: Trade, hideDollars: boolean): CardContent {
  const s = summarize(t);
  const stats: Stat[] = [];
  if (s.returnPct !== null) stats.push(["Return", `${s.returnPct > 0 ? "+" : ""}${s.returnPct}%`]);
  if (s.rMultiple !== null) stats.push(["R-multiple", `${s.rMultiple > 0 ? "+" : ""}${s.rMultiple}R`]);
  if (t.assetClass === "FUTURE" && s.pointsPerUnit !== null)
    stats.push(["Points", `${s.pointsPerUnit > 0 ? "+" : ""}${Math.round(s.pointsPerUnit * 100) / 100}${s.ticks !== null ? ` (${s.ticks}t)` : ""}`]);
  if (s.holdMinutes !== null) stats.push(["Time in trade", holdLabel(s.holdMinutes)]);
  if (!hideDollars && s.avgEntry !== null) stats.push(["Entry → Exit", `${priceRaw(s.avgEntry)} → ${priceRaw(s.avgExit)}`]);
  const day = (s.exitDate ?? s.entryDate ?? todayLocal()).slice(0, 10);
  return {
    kicker: `${ASSET_LABEL[t.assetClass]} · ${sideLabel(t)}${s.status === "OPEN" ? " · open" : ""}`,
    title: contractLabel(t),
    pnl: s.pnl,
    resultWord: s.pnl === null ? "OPEN" : s.pnl > 0 ? "WIN" : s.pnl < 0 ? "LOSS" : "BREAKEVEN",
    stats: stats.slice(0, 4),
    corner: format(parseLocal(day), "MMM d, yyyy"),
  };
}

type Period = "today" | "week" | "month";

function periodContent(rows: TradeRow[], period: Period): CardContent {
  const now = new Date();
  const from = period === "today" ? todayLocal() : format(period === "week" ? startOfWeek(now, { weekStartsOn: 1 }) : startOfMonth(now), "yyyy-MM-dd");
  const list = rows.filter((r) => r.s.status === "CLOSED" && tradeDay(r) >= from && tradeDay(r) <= todayLocal());
  const st = computeStats(list);
  const word = period === "today" ? "DAY" : period === "week" ? "WEEK" : "MONTH";
  const title =
    period === "today"
      ? format(now, "EEEE, MMM d")
      : period === "week"
        ? `${format(startOfWeek(now, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(now, { weekStartsOn: 1 }), "MMM d, yyyy")}`
        : format(now, "MMMM yyyy");
  const pf = st.profitFactor === null ? "—" : st.profitFactor === Infinity ? "No losses" : st.profitFactor.toFixed(2);
  return {
    kicker: period === "today" ? "Today" : period === "week" ? "This week" : "This month",
    title,
    pnl: st.closed ? st.totalPnl : null,
    resultWord: !st.closed ? "NO CLOSED TRADES" : st.totalPnl > 0 ? `GREEN ${word}` : st.totalPnl < 0 ? `RED ${word}` : `FLAT ${word}`,
    stats: st.closed
      ? [
          ["Trades", String(st.closed)],
          ["Win rate", `${st.winRate.toFixed(0)}%`],
          ["Wins / Losses", `${st.wins} / ${st.losses}`],
          ["Profit factor", pf],
        ]
      : [],
    corner: "Results",
  };
}

function ShareDialog({ open, onClose, build, picker }: { open: boolean; onClose: () => void; build: (hide: boolean) => CardContent; picker?: React.ReactNode }) {
  const [hide, setHide] = useState(numbersHidden());
  const [img, setImg] = useState<{ url: string; blob: Blob } | null>(null);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const content = useMemo(() => (open ? build(hide) : null), [open, build, hide]);

  useEffect(() => {
    if (!content) return;
    let live = true;
    let url = "";
    setImg(null);
    setCopied("idle");
    renderCard(content, hide)
      .then(canvasToPng)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (live) setImg({ url, blob });
      })
      .catch(() => live && setImg(null));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [content, hide]);

  const copy = async () => {
    if (!img) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": img.blob })]);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Share to Discord" wide>
      <div className="space-y-4">
        {picker}
        <div className="overflow-hidden rounded-xl border border-border-strong bg-surface-0" style={{ aspectRatio: "1200 / 675" }}>
          {img ? <img src={img.url} alt="Preview of your share image" className="h-full w-full" /> : <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-text-muted" /></div>}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          Hide dollar amounts (shows WIN / LOSS instead)
        </label>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={copy} disabled={!img}>
            {copied === "ok" ? <Check size={15} /> : <Copy size={15} />} {copied === "ok" ? "Copied! Paste it in Discord" : "Copy image"}
          </Button>
          <Button onClick={() => img && downloadBlob(img.blob, `spy-general-${todayLocal()}.png`)} disabled={!img}>
            <Download size={15} /> Download image
          </Button>
        </div>
        {copied === "fail" && <p className="text-sm text-warn-text">This browser can't copy pictures. Use Download image, then drag it into Discord.</p>}
        <p className="text-xs text-text-muted">The image is made on your computer. It only goes where you paste or send it.</p>
      </div>
    </Modal>
  );
}

export function ShareTradeButton({ trade }: { trade: Trade }) {
  const [open, setOpen] = useState(false);
  const build = useMemo(() => (hide: boolean) => tradeContent(trade, hide), [trade]);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Share2 size={14} /> Share</Button>
      <ShareDialog open={open} onClose={() => setOpen(false)} build={build} />
    </>
  );
}

export function ShareResultsButton({ rows }: { rows: TradeRow[] }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("week");
  const build = useMemo(() => () => periodContent(rows, period), [rows, period]);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Share2 size={15} /> Share results</Button>
      <ShareDialog
        open={open}
        onClose={() => setOpen(false)}
        build={build}
        picker={
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[{ value: "today", label: "Today" }, { value: "week", label: "This week" }, { value: "month", label: "This month" }]}
          />
        }
      />
    </>
  );
}
