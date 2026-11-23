import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Pencil, Trash2, ArrowLeft } from "lucide-react";
import { useJournal, useImageUrl } from "../lib/journal";
import { summarize, contractLabel, sideLabel, ASSET_LABEL, QTY_UNIT } from "../lib/calc";
import { dateLabel, holdLabel, money, price, qty, num } from "../lib/format";
import { Badge, Button, Card, Modal, PageHeader, Pnl } from "../components/ui";
import { ShareTradeButton } from "../components/Share";
import type { Fill } from "../lib/types";

export function TradeDetail() {
  const { id } = useParams();
  const { trades, deleteTrade } = useJournal();
  const nav = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const t = trades.find((x) => x.id === id);
  if (!t) return <div className="p-8 text-sm text-text-muted">That trade wasn't found. <Link className="text-accent underline" to="/trades">Back to trades</Link></div>;
  const s = summarize(t);
  const unit = QTY_UNIT[t.assetClass];

  const facts: [string, string][] = [
    ["Type", ASSET_LABEL[t.assetClass]],
    ["Size", `${qty(s.entryQty)} ${unit}`],
    ["Average entry", price(s.avgEntry)],
    ["Average exit", price(s.avgExit)],
    ["Opened", dateLabel(s.entryDate)],
    ["Closed", s.status === "CLOSED" ? dateLabel(s.exitDate) : "Still open"],
    ["Time in trade", holdLabel(s.holdMinutes)],
    ["Fees", money(t.fees)],
  ];
  if (t.assetClass === "OPTION" && t.option) {
    if (t.option.structure === "SINGLE") facts.push(["Option", `${t.option.type === "PUT" ? "Put" : "Call"} @ ${price(t.option.strike)}`]);
    else facts.push(["Spread", t.option.spreadName || "Spread (net price)"]);
    facts.push(["Expires", dateLabel(t.option.expiration || null)]);
    if (s.daysToExpiration !== null) facts.push(["Days to expiration at entry", String(s.daysToExpiration)]);
    if (t.option.multiplier !== 100) facts.push(["Shares per contract", String(t.option.multiplier)]);
  }
  if (t.assetClass === "FUTURE" && t.future) {
    facts.push(["Dollars per point", money(t.future.pointValue)]);
    if (s.pointsPerUnit !== null) facts.push(["Points", num(`${s.pointsPerUnit > 0 ? "+" : ""}${Math.round(s.pointsPerUnit * 10000) / 10000}`)]);
    if (s.ticks !== null) facts.push(["Ticks", num(String(s.ticks))]);
  }
  if (s.returnPct !== null) facts.push(["Return", num(`${s.returnPct > 0 ? "+" : ""}${s.returnPct}%`)]);
  if (t.stopLoss !== null) facts.push(["Stop loss", price(t.stopLoss)]);
  if (t.target !== null) facts.push(["Target", price(t.target)]);
  if (s.rMultiple !== null) facts.push(["R-multiple", num(`${s.rMultiple}R`)]);
  if (t.strategy) facts.push(["Strategy", t.strategy]);
  if (t.account) facts.push(["Account", t.account]);
  if (t.grade) facts.push(["Your grade", t.grade]);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {contractLabel(t)}
            <Badge tone={t.side === "LONG" ? "good" : "bad"}>{sideLabel(t)}</Badge>
            {s.status === "OPEN" && <Badge tone="warn">Open</Badge>}
          </span>
        }
        sub={<button type="button" onClick={() => nav(-1)} className="inline-flex items-center gap-1 hover:text-text-primary"><ArrowLeft size={13} /> Back</button>}
        action={
          <>
            <Link to={`/trades/${t.id}/edit`}><Button variant="primary"><Pencil size={14} /> {s.status === "OPEN" ? "Edit or close" : "Edit"}</Button></Link>
            <ShareTradeButton trade={t} />
            <Button variant="ghost" onClick={() => setConfirm(true)}><Trash2 size={14} /> Delete</Button>
          </>
        }
      />
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-5 md:px-8">
        <Card>
          <div className="mb-4 flex items-baseline gap-2">
            <Pnl value={s.pnl} className="text-3xl" />
            <span className="text-sm text-text-muted">{s.pnl === null ? "no result yet" : "result after fees"}</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-text-muted">{k}</dt>
                <dd className="mt-0.5 text-sm font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          {t.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{t.tags.map((x) => <Badge key={x}>{x}</Badge>)}</div>}
          {t.mistakes.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-text-muted">Mistakes:</span>
              {t.mistakes.map((x) => <Badge key={x} tone="bad">{x}</Badge>)}
            </div>
          )}
        </Card>

        <Card title="Fills">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FillTable label={t.side === "LONG" ? "Entries (buys)" : "Entries (sells)"} fills={t.entries} unit={unit} />
            <FillTable label={t.side === "LONG" ? "Exits (sells)" : "Exits (buys)"} fills={t.exits} unit={unit} empty="Still open." />
          </div>
        </Card>

        {t.notes && <Card title="Notes"><p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{t.notes}</p></Card>}

        {t.screenshotIds.length > 0 && (
          <Card title="Screenshots">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {t.screenshotIds.map((sid) => <Shot key={sid} id={sid} onOpen={setZoom} />)}
            </div>
          </Card>
        )}
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Delete this trade?">
        <p className="text-sm text-text-secondary">{contractLabel(t)} and its screenshots will be removed from your journal.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => setConfirm(false)}>Keep it</Button>
          <Button variant="danger" onClick={async () => { await deleteTrade(t); nav("/trades", { replace: true }); }}>Delete</Button>
        </div>
      </Modal>
      <Modal open={!!zoom} onClose={() => setZoom(null)} title="Screenshot" wide>
        {zoom && <img src={zoom} alt="" className="w-full rounded-lg" />}
      </Modal>
    </>
  );
}

function Shot({ id, onOpen }: { id: string; onOpen: (u: string) => void }) {
  const url = useImageUrl(id);
  return (
    <button type="button" onClick={() => url && onOpen(url)} className="block overflow-hidden rounded-lg border border-border-strong bg-surface-2">
      {url ? <img src={url} alt="" className="aspect-video w-full object-cover" /> : <div className="aspect-video" />}
    </button>
  );
}

function FillTable({ label, fills, unit, empty = "None." }: { label: string; fills: Fill[]; unit: string; empty?: string }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium text-text-muted">{label}</h3>
      {fills.length === 0 ? (
        <p className="text-sm text-text-muted">{empty}</p>
      ) : (
        <div className="space-y-1.5">
          {[...fills].sort((a, b) => a.date.localeCompare(b.date)).map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-text-secondary">{dateLabel(f.date)}</span>
              <span className="font-medium tabular-nums">{price(f.price)} × {qty(f.quantity)} {unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
