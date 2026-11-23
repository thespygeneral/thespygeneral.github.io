import { NavLink, Outlet, useLocation, Link } from "react-router";
import { LayoutDashboard, CalendarDays, ListOrdered, Plus, ShieldCheck, Lock, HardDriveDownload, KeyRound, Eye, EyeOff } from "lucide-react";
import { useHide } from "../lib/hide";
import { useEffect, useState } from "react";
import { APP_NAME, COMMUNITY_NAME } from "../config";
import { useJournal } from "../lib/journal";
import { cn, daysAgo } from "../lib/format";
import { Button, Notice } from "./ui";
import { SpyBadge } from "./Badge";
import { BackupButton } from "./BackupButton";
import { getMeta, setMeta } from "../lib/storage";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/trades", label: "Trades", icon: ListOrdered, end: true },
  { to: "/protect", label: "Backup & Privacy", icon: ShieldCheck },
];

export function Layout() {
  const { passcodeOn, lockNow } = useJournal();
  const loc = useLocation();
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border-strong bg-surface-1 px-4 py-5 md:flex">
        <Brand />
        <Link to="/trades/new" className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-black hover:bg-accent/90">
          <Plus size={16} strokeWidth={2.5} /> Log a Trade
        </Link>
        <HideButton className="mb-6 mt-2 w-full" />
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive || (to === "/trades" && loc.pathname.startsWith("/trades/") && loc.pathname !== "/trades/new")
                    ? "bg-surface-2 text-text-primary"
                    : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                )
              }
            >
              <Icon size={17} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          {passcodeOn && (
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={lockNow}>
              <Lock size={14} /> Lock now
            </Button>
          )}
          <div className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-text-secondary">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-good-text" />
            <span>Your trades are saved only on this computer. Nothing is sent anywhere.</span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="flex items-center justify-between border-b border-border-strong bg-surface-1 px-4 py-3 md:hidden">
          <Brand compact />
          <div className="flex items-center gap-2">
            <HideButton compact />
            {passcodeOn && (
              <button onClick={lockNow} className="rounded-lg p-2 text-text-muted hover:bg-surface-2" aria-label="Lock now">
                <Lock size={18} />
              </button>
            )}
            <Link to="/trades/new" className="flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-black">
              <Plus size={16} /> Log
            </Link>
          </div>
        </header>
        <Reminders />
        <main className="flex-1 animate-fade-in" key={loc.pathname}>
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border-strong bg-surface-1 pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cn("flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium", isActive ? "text-accent" : "text-text-muted")}
          >
            <Icon size={19} />
            {label === "Backup & Privacy" ? "Backup" : label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** One switch for the whole app: hides every dollar amount, price, size and percent (colors stay). */
function HideButton({ compact, className }: { compact?: boolean; className?: string }) {
  const { hidden, toggle } = useHide();
  const Icon = hidden ? Eye : EyeOff;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      title={hidden ? "Show my numbers" : "Hide my numbers (for screen sharing)"}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors",
        compact ? "px-2.5 py-2 text-xs" : "px-3 py-2",
        hidden
          ? "border-warn/40 bg-warn/15 text-warn-text hover:bg-warn/25"
          : "border-border-strong text-text-secondary hover:bg-surface-2 hover:text-text-primary",
        className
      )}
    >
      <Icon size={compact ? 15 : 16} />
      {compact ? (hidden ? "Show" : "Hide") : hidden ? "Numbers hidden · Show" : "Hide numbers"}
    </button>
  );
}

export function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", !compact && "px-2 pb-6")}>
      <SpyBadge size={compact ? 30 : 40} />
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight">{APP_NAME}</div>
        {COMMUNITY_NAME && !compact && <div className="text-[11px] text-text-muted">for {COMMUNITY_NAME} members</div>}
      </div>
    </div>
  );
}

/** Gentle, dismissible nudges. At most one shows at a time, most important first. */
function Reminders() {
  const { trades, lastBackup, settings, autoBackup, passcodeOn, backupNow } = useJournal();
  const [snoozed, setSnoozed] = useState<Record<string, boolean>>({});
  const [passcodeDismissed, setPasscodeDismissed] = useState(true);
  const onForm = /^\/trades\/(new|[^/]+\/edit)$/.test(useLocation().pathname);
  useEffect(() => {
    getMeta<boolean>("passcodeTipDismissed").then((v) => setPasscodeDismissed(!!v));
  }, []);

  if (trades.length === 0 || onForm) return null;
  const age = daysAgo(lastBackup);

  let content = null;
  if (autoBackup.state === "needs-permission" && !snoozed.perm) {
    content = (
      <Notice
        tone="warn"
        icon={<HardDriveDownload size={16} />}
        action={<Button size="sm" variant="primary" onClick={() => backupNow(true).then(() => setSnoozed((s) => ({ ...s, perm: true })))}>Allow</Button>}
      >
        Your browser needs one click to keep updating your backup file.
      </Notice>
    );
  } else if (!autoBackup.file && (age === null || age >= settings.backupReminderDays) && !snoozed.backup) {
    content = (
      <Notice
        tone="warn"
        icon={<HardDriveDownload size={16} />}
        action={
          <>
            <BackupButton size="sm" variant="primary" label="Back up now" />
            <Button size="sm" variant="ghost" onClick={() => setSnoozed((s) => ({ ...s, backup: true }))}>Later</Button>
          </>
        }
      >
        {age === null ? "You haven't saved a backup yet." : `Your last backup was ${age} days ago.`} A backup file keeps your journal safe if this browser is ever cleared.
      </Notice>
    );
  } else if (!passcodeOn && !passcodeDismissed && trades.length >= 3) {
    content = (
      <Notice
        icon={<KeyRound size={16} />}
        action={
          <>
            <Link to="/protect"><Button size="sm" variant="primary">Set a passcode</Button></Link>
            <Button size="sm" variant="ghost" onClick={() => { setPasscodeDismissed(true); setMeta("passcodeTipDismissed", true); }}>No thanks</Button>
          </>
        }
      >
        Share this computer with anyone? Add a passcode so only you can open your journal.
      </Notice>
    );
  }
  if (!content) return null;
  return <div className="px-4 pt-4 md:px-8">{content}</div>;
}
