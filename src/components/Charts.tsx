import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie } from "recharts";
import type { Bucket, EquityPoint } from "../lib/calc";
import { money, signedMoney } from "../lib/format";
import { parseLocal } from "../lib/calc";

const axis = { fill: "var(--text-muted)", fontSize: 11 };
const short = (v: number) => (Math.abs(v) >= 1000 ? `${v < 0 ? "-" : ""}$${(Math.abs(v) / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1)}k` : money(v).replace(".00", ""));

function Tip({ active, label, payload, labelFmt }: { active?: boolean; label?: string; payload?: { value: number; payload: Record<string, number> }[]; labelFmt?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-border-strong bg-surface-1 px-3 py-2 text-xs shadow-lg">
      {label && <div className="mb-0.5 text-text-muted">{labelFmt ? labelFmt(label) : label}</div>}
      <div className={p.value >= 0 ? "font-semibold text-good-text" : "font-semibold text-critical-text"}>{signedMoney(p.value)}</div>
      {p.payload.trades !== undefined && <div className="text-text-muted">{p.payload.trades} trade{p.payload.trades === 1 ? "" : "s"}</div>}
    </div>
  );
}

const Empty = ({ h, text }: { h: number; text: string }) => (
  <div className="flex items-center justify-center text-sm text-text-muted" style={{ height: h }}>{text}</div>
);

const dayLabel = (d: string) => parseLocal(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function EquityChart({ data }: { data: EquityPoint[] }) {
  if (!data.length) return <Empty h={260} text="Close a trade and your account growth line appears here." />;
  const last = data[data.length - 1].cumPnl;
  const color = last >= 0 ? "var(--good)" : "var(--critical)";
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border-strong)" vertical={false} />
        <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border-strong)" }} minTickGap={40} tickFormatter={(d) => parseLocal(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={56} tickFormatter={short} />
        <Tooltip content={<Tip labelFmt={dayLabel} />} cursor={{ stroke: "var(--border-strong)" }} />
        <Area type="monotone" dataKey="cumPnl" stroke={color} strokeWidth={2} fill="url(#eq)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BucketChart({ data, height = 220 }: { data: Bucket[]; height?: number }) {
  if (!data.length) return <Empty h={height} text="No closed trades yet." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--border-strong)" vertical={false} />
        <XAxis dataKey="key" tick={axis} tickLine={false} axisLine={{ stroke: "var(--border-strong)" }} interval={0} />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={short} />
        <Tooltip content={<Tip />} cursor={{ fill: "var(--surface-2)" }} />
        <Bar dataKey="pnl" radius={[4, 4, 4, 4]} maxBarSize={36}>
          {data.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? "var(--good)" : "var(--critical)"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WinDonut({ wins, losses, breakeven }: { wins: number; losses: number; breakeven: number }) {
  const total = wins + losses + breakeven;
  if (!total) return <Empty h={220} text="No closed trades yet." />;
  const data = [
    { name: "Wins", value: wins, color: "var(--good)" },
    { name: "Losses", value: losses, color: "var(--critical)" },
    ...(breakeven ? [{ name: "Even", value: breakeven, color: "var(--text-muted)" }] : []),
  ];
  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={190}>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={58} outerRadius={80} paddingAngle={2} startAngle={90} endAngle={-270} stroke="var(--surface-1)" strokeWidth={2} isAnimationActive={false}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{((wins / total) * 100).toFixed(0)}%</span>
          <span className="text-xs text-text-muted">wins</span>
        </div>
      </div>
      <div className="mt-2 flex justify-center gap-4 text-xs text-text-secondary">
        {data.map((d) => (
          <span key={d.name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: d.color }} /> {d.name} {d.value}
          </span>
        ))}
      </div>
    </div>
  );
}
