import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router";
import { Plus, X, Upload, Loader2, TrendingUp, Layers, BarChart3, ArrowLeft, ImagePlus } from "lucide-react";
import { useJournal, useImageUrl } from "../lib/journal";
import { blankTrade, newId } from "../lib/ids";
import { summarize, QTY_LABEL, contractLabel } from "../lib/calc";
import { FUTURES, findFuture } from "../lib/futures";
import { prepareScreenshot } from "../lib/images";
import { cn, nowLocal, signedMoney, num, price as fmtPrice } from "../lib/format";
import type { AssetClass, Fill, Trade } from "../lib/types";
import { Button, Card, Field, Input, NumberInput, PageHeader, Segmented, Select, inputClass } from "../components/ui";

const TYPES: { value: AssetClass; title: string; text: string; icon: typeof TrendingUp }[] = [
  { value: "EQUITY", title: "Stock", text: "Shares and ETFs", icon: TrendingUp },
  { value: "OPTION", title: "Option", text: "Calls, puts and spreads", icon: Layers },
  { value: "FUTURE", title: "Future", text: "ES, NQ, oil, gold and more", icon: BarChart3 },
];

/** Words that match how traders describe each step, per type and direction. */
function words(t: Trade) {
  const long = t.side === "LONG";
  if (t.assetClass === "OPTION")
    return { entry: long ? "Buy to open" : "Sell to open", exit: long ? "Sell to close" : "Buy to close", price: "Price per contract", priceHint: "The premium, e.g. 2.15" };
  if (t.assetClass === "FUTURE")
    return { entry: long ? "Buy" : "Sell", exit: long ? "Sell" : "Buy back", price: "Price", priceHint: "" };
  return { entry: long ? "Buy" : "Sell short", exit: long ? "Sell" : "Buy to cover", price: "Price per share", priceHint: "" };
}

type NewImage = { id: string; blob: Blob; url: string };

export function TradeForm() {
  const { id } = useParams();
  const { trades, lists, saveTrade } = useJournal();
  const nav = useNavigate();
  const existing = id ? trades.find((t) => t.id === id) : undefined;

  const [t, setT] = useState<Trade | null>(() => (existing ? structuredClone(existing) : null));
  const [newImages, setNewImages] = useState<NewImage[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (id && !existing) {
    return <div className="p-8 text-sm text-text-muted">That trade wasn't found. <Link className="text-accent underline" to="/trades">Back to trades</Link></div>;
  }

  // Step 1: what did you trade?
  if (!t) {
    return (
      <>
        <PageHeader title="Log a Trade" sub="What did you trade?" />
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-3 px-4 py-8 sm:grid-cols-3 md:px-8">
          {TYPES.map(({ value, title, text, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                const b = blankTrade(value);
                b.entries = [{ id: newId(), date: nowLocal(), price: NaN, quantity: NaN }];
                b.exits = [{ id: newId(), date: nowLocal(), price: NaN, quantity: NaN }];
                setT(b);
              }}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-border-strong bg-surface-1 px-4 py-8 text-center transition-colors hover:border-accent hover:bg-accent/5"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-accent"><Icon size={24} /></span>
              <span className="text-lg font-semibold">{title}</span>
              <span className="text-sm text-text-muted">{text}</span>
            </button>
          ))}
        </div>
      </>
    );
  }

  const update = (patch: Partial<Trade>) => {
    setT((cur) => (cur ? { ...cur, ...patch } : cur));
    setDirty(true);
    if (Object.keys(errors).length) setErrors({});
  };

  const onSave = async () => {
    const clean = finalize(t);
    const errs = validate(clean);
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.querySelector("[data-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(true);
    try {
      const screenshotIds = [...clean.screenshotIds.filter((x) => !removed.includes(x)), ...newImages.map((i) => i.id)];
      await saveTrade({ ...clean, screenshotIds }, newImages.map(({ id, blob }) => ({ id, blob })), removed);
      setDirty(false);
      nav(`/trades/${clean.id}`, { replace: true });
    } finally {
      setSaving(false);
    }
  };

  const w = words(t);

  return (
    <>
      <PageHeader
        title={existing ? `Edit ${contractLabel(existing)}` : `Log ${t.assetClass === "OPTION" ? "an" : "a"} ${TYPES.find((x) => x.value === t.assetClass)!.title} Trade`}
        sub={!existing && (
          <button type="button" onClick={() => setT(null)} className="inline-flex items-center gap-1 text-text-muted hover:text-text-primary">
            <ArrowLeft size={13} /> Pick a different type
          </button>
        )}
      />
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-5 md:px-8">
        <Card title="What you traded">
          <InstrumentFields t={t} update={update} errors={errors} />
        </Card>

        <Card title="Your fills" action={<span className="hidden text-xs text-text-muted sm:inline">Bought in more than once? Add a row for each.</span>}>
          <FillList
            title={w.entry}
            fills={t.entries}
            onChange={(entries) => update({ entries })}
            qtyLabel={QTY_LABEL[t.assetClass]}
            priceLabel={w.price}
            error={errors.entries}
          />
          <div className="my-5 border-t border-border-strong" />
          <FillList
            title={w.exit}
            hint="Leave blank if you're still in the trade."
            fills={t.exits}
            onChange={(exits) => update({ exits })}
            qtyLabel={QTY_LABEL[t.assetClass]}
            priceLabel={w.price}
            error={errors.exits}
            extra={
              t.assetClass === "OPTION" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const qty = t.entries.reduce((s, f) => s + (Number.isFinite(f.quantity) ? f.quantity : 0), 0);
                    const date = t.option?.expiration || nowLocal().slice(0, 10);
                    update({ exits: [{ id: newId(), date, price: 0, quantity: qty || NaN }] });
                  }}
                >
                  Expired worthless
                </Button>
              )
            }
          />
          <ResultPreview t={t} />
        </Card>

        <Card title="Details" action={<span className="text-xs text-text-muted">All optional</span>}>
          <DetailFields t={t} update={update} lists={lists} />
        </Card>

        <Card title="Screenshots" action={<span className="hidden text-xs text-text-muted sm:inline">Optional · you can paste with Ctrl/⌘ + V</span>}>
          <Screenshots
            existing={t.screenshotIds.filter((x) => !removed.includes(x))}
            added={newImages}
            onAdd={(imgs) => { setNewImages((cur) => [...cur, ...imgs]); setDirty(true); }}
            onRemoveExisting={(x) => { setRemoved((cur) => [...cur, x]); setDirty(true); }}
            onRemoveNew={(x) => { setNewImages((cur) => cur.filter((i) => i.id !== x)); setDirty(true); }}
          />
        </Card>

        {Object.keys(errors).length > 0 && (
          <p className="text-sm text-critical-text">Please fix the highlighted boxes above.</p>
        )}
        <div className="sticky bottom-16 z-10 flex gap-2 rounded-xl border border-border-strong bg-surface-1/95 p-3 backdrop-blur md:bottom-4">
          <Button variant="primary" size="lg" className="flex-1" onClick={onSave} disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin" />} {existing ? "Save changes" : "Save trade"}
          </Button>
          <Button size="lg" onClick={() => { setDirty(false); nav(-1); }}>Cancel</Button>
        </div>
      </div>
    </>
  );
}

// ---------------- Instrument (changes by type) ----------------

function InstrumentFields({ t, update, errors }: { t: Trade; update: (p: Partial<Trade>) => void; errors: Record<string, string> }) {
  if (t.assetClass === "EQUITY") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Ticker" error={errors.symbol}>
          <Input autoFocus placeholder="e.g. AAPL" value={t.symbol} onChange={(e) => update({ symbol: e.target.value.toUpperCase() })} data-error={errors.symbol ? "" : undefined} />
        </Field>
        <Field group label="Direction" hint={t.side === "LONG" ? "You bought first, hoping it goes up." : "You sold first, hoping it goes down."}>
          <Segmented value={t.side} onChange={(side) => update({ side })} options={[{ value: "LONG", label: "Long", tone: "good" }, { value: "SHORT", label: "Short", tone: "bad" }]} />
        </Field>
      </div>
    );
  }

  if (t.assetClass === "OPTION" && t.option) {
    const o = t.option;
    const setO = (p: Partial<typeof o>) => update({ option: { ...o, ...p } });
    const kind = o.structure === "SPREAD" ? "SPREAD" : o.type ?? "CALL";
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Underlying" hint="The stock or index the option is on." error={errors.symbol}>
          <Input autoFocus placeholder="e.g. SPY" value={t.symbol} onChange={(e) => update({ symbol: e.target.value.toUpperCase() })} data-error={errors.symbol ? "" : undefined} />
        </Field>
        <Field group label="Did you buy or sell the option?" hint={t.side === "LONG" ? "You paid for it (opened with a buy)." : "You collected the premium (opened with a sell)."}>
          <Segmented value={t.side} onChange={(side) => update({ side })} options={[{ value: "LONG", label: "Bought", tone: "good" }, { value: "SHORT", label: "Sold", tone: "bad" }]} />
        </Field>
        <Field group label="Kind" className="sm:col-span-2">
          <Segmented
            value={kind}
            onChange={(k) => (k === "SPREAD" ? setO({ structure: "SPREAD", type: null }) : setO({ structure: "SINGLE", type: k }))}
            options={[{ value: "CALL", label: "Call" }, { value: "PUT", label: "Put" }, { value: "SPREAD", label: "Spread" }]}
          />
        </Field>
        {o.structure === "SINGLE" ? (
          <Field label="Strike price" error={errors.strike}>
            <NumberInput placeholder="e.g. 550" value={o.strike} onChange={(strike) => setO({ strike })} data-error={errors.strike ? "" : undefined} />
          </Field>
        ) : (
          <Field label="Spread name" hint="e.g. Iron condor 5900/5910/6100/6110. Enter the spread's total (net) price below.">
            <Input placeholder="e.g. Call debit spread 550/555" value={o.spreadName} onChange={(e) => setO({ spreadName: e.target.value })} />
          </Field>
        )}
        <Field label="Expiration date" error={errors.expiration}>
          <Input type="date" value={o.expiration} onChange={(e) => setO({ expiration: e.target.value })} data-error={errors.expiration ? "" : undefined} />
        </Field>
        <Field label="Shares per contract" hint="Almost always 100. Only change this for mini or adjusted options.">
          <NumberInput value={o.multiplier} onChange={(m) => setO({ multiplier: m ?? 100 })} />
        </Field>
      </div>
    );
  }

  if (t.assetClass === "FUTURE" && t.future) {
    const f = t.future;
    const spec = findFuture(f.contract);
    const isOther = !spec && f.contract !== "";
    const other = isOther || f.contract === "__OTHER__";
    const groups = [...new Set(FUTURES.map((x) => x.group))];
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Contract" error={errors.symbol} hint={spec ? `${spec.name}: $${spec.pointValue.toLocaleString()} per point, tick ${spec.tickSize}` : undefined}>
          <Select
            autoFocus
            value={spec ? spec.root : other ? "__OTHER__" : ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__OTHER__") return update({ symbol: "", future: { ...f, contract: "__OTHER__", pointValue: 0, tickSize: 0 } });
              const s = findFuture(v);
              if (s) update({ symbol: s.root, future: { ...f, contract: s.root, pointValue: s.pointValue, tickSize: s.tickSize } });
            }}
            data-error={errors.symbol ? "" : undefined}
          >
            <option value="">Choose a contract…</option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {FUTURES.filter((x) => x.group === g).map((x) => <option key={x.root} value={x.root}>{x.root} · {x.name}</option>)}
              </optgroup>
            ))}
            <option value="__OTHER__">Other contract…</option>
          </Select>
        </Field>
        <Field group label="Direction">
          <Segmented value={t.side} onChange={(side) => update({ side })} options={[{ value: "LONG", label: "Long", tone: "good" }, { value: "SHORT", label: "Short", tone: "bad" }]} />
        </Field>
        {other && (
          <>
            <Field label="Contract symbol" error={errors.symbol}>
              <Input placeholder="e.g. HE" value={t.symbol} onChange={(e) => update({ symbol: e.target.value.toUpperCase(), future: { ...f, contract: "__OTHER__" } })} />
            </Field>
            <Field label="Dollars per 1.00 point" hint="From your broker's contract specs." error={errors.pointValue}>
              <NumberInput placeholder="e.g. 400" value={f.pointValue || null} onChange={(v) => update({ future: { ...f, pointValue: v ?? 0 } })} data-error={errors.pointValue ? "" : undefined} />
            </Field>
            <Field label="Tick size (optional)" hint="Smallest price move, e.g. 0.25">
              <NumberInput value={f.tickSize || null} onChange={(v) => update({ future: { ...f, tickSize: v ?? 0 } })} />
            </Field>
          </>
        )}
        <Field label="Contract month (optional)">
          <Input type="month" value={f.contractMonth} onChange={(e) => update({ future: { ...f, contractMonth: e.target.value } })} />
        </Field>
      </div>
    );
  }
  return null;
}

// ---------------- Fills ----------------

function FillList({
  title, hint, fills, onChange, qtyLabel, priceLabel, error, extra,
}: {
  title: string; hint?: string; fills: Fill[]; onChange: (f: Fill[]) => void; qtyLabel: string; priceLabel: string; error?: string; extra?: React.ReactNode;
}) {
  const set = (i: number, p: Partial<Fill>) => onChange(fills.map((f, j) => (j === i ? { ...f, ...p } : f)));
  return (
    <div data-error={error ? "" : undefined}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {hint && <div className="text-xs text-text-muted">{hint}</div>}
        </div>
        <div className="flex items-center gap-1">
          {extra}
          <Button size="sm" variant="ghost" onClick={() => onChange([...fills, { id: newId(), date: fills[fills.length - 1]?.date || nowLocal(), price: NaN, quantity: NaN }])}>
            <Plus size={13} /> Add row
          </Button>
        </div>
      </div>
      {fills.length > 0 && (
        <div className="mb-1 hidden grid-cols-[1.4fr_1fr_1fr_42px] gap-2 text-[11px] font-medium text-text-muted sm:grid">
          <span>Date & time</span>
          <span>{priceLabel}</span>
          <span>{qtyLabel}</span>
        </div>
      )}
      <div className="space-y-2">
        {fills.map((f, i) => (
          <div key={f.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
            <label className="col-span-2 sm:col-span-1">
              <span className="sr-only">Date and time</span>
              <input type="datetime-local" value={f.date.length === 10 ? `${f.date}T00:00` : f.date} onChange={(e) => set(i, { date: e.target.value })} className={inputClass} />
            </label>
            <label className="row-start-2 sm:row-start-auto">
              <span className="mb-1 block text-[11px] text-text-muted sm:hidden">{priceLabel}</span>
              <NumberInput placeholder={priceLabel} aria-label={priceLabel} value={Number.isFinite(f.price) ? f.price : null} onChange={(v) => set(i, { price: v ?? NaN })} />
            </label>
            <label className="row-start-2 sm:row-start-auto">
              <span className="mb-1 block text-[11px] text-text-muted sm:hidden">{qtyLabel}</span>
              <NumberInput placeholder={qtyLabel} aria-label={qtyLabel} value={Number.isFinite(f.quantity) ? f.quantity : null} onChange={(v) => set(i, { quantity: v ?? NaN })} />
            </label>
            <button
              type="button"
              onClick={() => onChange(fills.filter((_, j) => j !== i))}
              className="col-start-3 row-start-1 self-start rounded-lg border border-border-strong p-2.5 text-text-muted hover:text-critical-text sm:col-start-auto sm:row-start-auto"
              aria-label="Remove row"
            >
              <X size={15} />
            </button>
          </div>
        ))}
        {fills.length === 0 && <div className="rounded-lg border border-dashed border-border-strong px-3 py-3 text-xs text-text-muted">Nothing yet.</div>}
      </div>
      {error && <p className="mt-2 text-xs text-critical-text">{error}</p>}
    </div>
  );
}

function ResultPreview({ t }: { t: Trade }) {
  const s = useMemo(() => summarize(finalize(t)), [t]);
  if (!s.entryQty) return null;
  const items: [string, React.ReactNode][] = [
    ["Average entry", fmtPrice(s.avgEntry)],
    ["Status", s.status === "OPEN" ? (s.exitQty ? `Open (${s.openQty} left)` : "Still open") : "Closed"],
  ];
  if (s.avgExit !== null) items.push(["Average exit", fmtPrice(s.avgExit)]);
  if (t.assetClass === "FUTURE" && s.pointsPerUnit !== null) items.push(["Points", num(`${s.pointsPerUnit > 0 ? "+" : ""}${Math.round(s.pointsPerUnit * 10000) / 10000}${s.ticks !== null ? ` (${s.ticks} ticks)` : ""}`)]);
  if (s.returnPct !== null) items.push(["Return", num(`${s.returnPct > 0 ? "+" : ""}${s.returnPct}%`)]);
  if (s.rMultiple !== null) items.push(["R-multiple", num(`${s.rMultiple}R`)]);
  return (
    <div className="mt-5 rounded-xl border border-border-strong bg-surface-2 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-text-muted">Result {t.fees ? "(after fees)" : ""}</span>
        <span className={cn("text-2xl font-semibold tabular-nums", s.pnl === null ? "text-text-muted" : s.pnl > 0 ? "text-good-text" : s.pnl < 0 ? "text-critical-text" : "")}>
          {s.pnl === null ? "—" : signedMoney(s.pnl)}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        {items.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-text-muted">{k}</dt>
            <dd className="font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ---------------- Details ----------------

function DetailFields({ t, update, lists }: { t: Trade; update: (p: Partial<Trade>) => void; lists: { strategies: string[]; accounts: string[] } }) {
  const [tag, setTag] = useState("");
  const addTag = () => {
    const v = tag.trim().replace(/,$/, "");
    if (v && !t.tags.includes(v)) update({ tags: [...t.tags, v] });
    setTag("");
  };
  const stopHint = t.assetClass === "OPTION" ? "The option price where you'd get out." : "Lets the journal show your R-multiple.";
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Fees & commissions (total)">
        <NumberInput placeholder="0.00" value={t.fees || null} onChange={(v) => update({ fees: v ?? 0 })} />
      </Field>
      <Field group label="Grade yourself" hint="How well did you follow your plan?">
        <Segmented value={t.grade || "none"} onChange={(g) => update({ grade: g === "none" ? "" : (g as Trade["grade"]) })} options={[{ value: "none", label: "—" }, ...["A", "B", "C", "D", "F"].map((g) => ({ value: g, label: g }))]} />
      </Field>
      <Field label="Stop loss" hint={stopHint}>
        <NumberInput value={t.stopLoss} onChange={(stopLoss) => update({ stopLoss })} />
      </Field>
      <Field label="Profit target">
        <NumberInput value={t.target} onChange={(target) => update({ target })} />
      </Field>
      <Field label="Strategy / setup" hint="Type a new one or pick one you've used.">
        <Input list="strategies" placeholder="e.g. Opening range breakout" value={t.strategy} onChange={(e) => update({ strategy: e.target.value })} />
        <datalist id="strategies">{lists.strategies.map((s) => <option key={s} value={s} />)}</datalist>
      </Field>
      <Field label="Account" hint="Useful if you trade more than one account.">
        <Input list="accounts" placeholder="e.g. Main, IRA, Prop firm" value={t.account} onChange={(e) => update({ account: e.target.value })} />
        <datalist id="accounts">{lists.accounts.map((s) => <option key={s} value={s} />)}</datalist>
      </Field>
      <Field group label="Tags" className="sm:col-span-2" hint="Press Enter after each one.">
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border-strong bg-surface-0 px-2 py-1.5">
          {t.tags.map((x) => (
            <span key={x} className="flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-xs font-medium text-text-secondary">
              {x}
              <button type="button" aria-label={`Remove ${x}`} onClick={() => update({ tags: t.tags.filter((y) => y !== x) })} className="text-text-muted hover:text-text-primary"><X size={12} /></button>
            </span>
          ))}
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); }
              else if (e.key === "Backspace" && !tag && t.tags.length) update({ tags: t.tags.slice(0, -1) });
            }}
            onBlur={addTag}
            aria-label="Add a tag"
            placeholder={t.tags.length ? "" : "e.g. FOMO, earnings, A+ setup"}
            className="min-w-[140px] flex-1 bg-transparent py-1 text-sm placeholder:text-text-muted focus:outline-none"
          />
        </div>
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <textarea rows={5} value={t.notes} onChange={(e) => update({ notes: e.target.value })} placeholder="Why you took it, how you felt, what you'd do differently…" className={cn(inputClass, "resize-y")} />
      </Field>
    </div>
  );
}

// ---------------- Screenshots ----------------

function Screenshots({
  existing, added, onAdd, onRemoveExisting, onRemoveNew,
}: {
  existing: string[]; added: NewImage[]; onAdd: (i: NewImage[]) => void; onRemoveExisting: (id: string) => void; onRemoveNew: (id: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const take = async (files: (File | Blob)[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    setBusy(true);
    try {
      const out: NewImage[] = [];
      for (const f of imgs) {
        const blob = await prepareScreenshot(f);
        out.push({ id: newId(), blob, url: URL.createObjectURL(blob) });
      }
      onAdd(out);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.some((f) => f.type.startsWith("image/"))) {
        e.preventDefault();
        take(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); take([...e.dataTransfer.files]); }}
      className={cn("rounded-xl", drag && "ring-2 ring-accent")}
    >
      <div className="flex flex-wrap gap-3">
        {existing.map((id) => <Thumb key={id} id={id} onRemove={() => onRemoveExisting(id)} />)}
        {added.map((im) => <Thumb key={im.id} url={im.url} onRemove={() => onRemoveNew(im.id)} />)}
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="flex h-24 w-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong text-text-muted hover:border-accent hover:text-accent"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
          <span className="text-xs">Add picture</span>
        </button>
        <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { take([...(e.target.files ?? [])]); e.target.value = ""; }} />
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-text-muted"><Upload size={11} /> Drag pictures here, paste a screenshot, or click Add picture.</p>
    </div>
  );
}

function Thumb({ id, url, onRemove }: { id?: string; url?: string; onRemove: () => void }) {
  const stored = useImageUrl(id ?? null);
  const src = url ?? stored;
  return (
    <div className="group relative h-24 w-32 overflow-hidden rounded-lg border border-border-strong bg-surface-2">
      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
      <button type="button" onClick={onRemove} aria-label="Remove picture" className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white">
        <X size={12} />
      </button>
    </div>
  );
}

// ---------------- Clean-up + checks ----------------

/** Drops blank fill rows and tidies values before saving or previewing. */
function finalize(t: Trade): Trade {
  const ok = (f: Fill) => Number.isFinite(f.price) && Number.isFinite(f.quantity) && f.quantity > 0 && !!f.date;
  const symbol = t.symbol.trim().toUpperCase();
  return {
    ...t,
    symbol,
    entries: t.entries.filter(ok),
    exits: t.exits.filter(ok),
    fees: Number.isFinite(t.fees) ? Math.abs(t.fees) : 0,
    tags: t.tags.map((x) => x.trim()).filter(Boolean),
    strategy: t.strategy.trim(),
    account: t.account.trim(),
    future: t.future ? { ...t.future, contract: t.future.contract === "__OTHER__" ? symbol : t.future.contract } : null,
  };
}

function validate(t: Trade): Record<string, string> {
  const e: Record<string, string> = {};
  if (!t.symbol) e.symbol = t.assetClass === "FUTURE" ? "Choose a contract." : t.assetClass === "OPTION" ? "Enter the underlying, like SPY." : "Enter the ticker, like AAPL.";
  if (!t.entries.length) e.entries = "Enter at least one row with a price and amount.";
  const inQty = t.entries.reduce((s, f) => s + f.quantity, 0);
  const outQty = t.exits.reduce((s, f) => s + f.quantity, 0);
  if (outQty > inQty + 1e-9) e.exits = `You closed ${outQty} but only opened ${inQty}. Check the amounts.`;
  if (t.entries.some((f) => f.price < 0) || t.exits.some((f) => f.price < 0)) e.entries = "Prices can't be negative.";
  if (t.assetClass === "OPTION" && t.option) {
    if (t.option.structure === "SINGLE" && (t.option.strike === null || t.option.strike <= 0)) e.strike = "Enter the strike price.";
    if (!t.option.expiration) e.expiration = "Enter the expiration date.";
    else if (t.entries.some((f) => f.date.slice(0, 10) > t.option!.expiration)) e.expiration = "This is before your entry date. Check the expiration.";
  }
  if (t.assetClass === "FUTURE" && t.future && !(t.future.pointValue > 0)) e.pointValue = "Enter how many dollars one point is worth.";
  const firstIn = t.entries.map((f) => f.date).sort()[0];
  const firstOut = t.exits.map((f) => f.date).sort()[0];
  if (firstIn && firstOut && firstOut < firstIn) e.exits = "The exit is dated before the entry. Check the dates.";
  return e;
}
