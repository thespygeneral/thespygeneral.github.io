import { useRef, useState } from "react";
import { ShieldCheck, Loader2, Gift, CandlestickChart, Laptop } from "lucide-react";
import { SpyBadge } from "../components/Badge";
import { APP_NAME, COMMUNITY_NAME } from "../config";
import { useJournal } from "../lib/journal";
import { unlock, unlockWithRecovery, eraseEverything } from "../lib/storage";
import { Button, Input, Modal } from "../components/ui";
import { RestoreFlow } from "../components/RestoreFlow";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">{children}</div>
    </div>
  );
}

export function Welcome() {
  const { finishWelcome, reload } = useJournal();
  const [restoring, setRestoring] = useState(false);
  const points = [
    { icon: Laptop, title: "Saved on your computer only", text: "Your trades never leave this device. There's no account, and nobody else can see them." },
    { icon: Gift, title: "Free, with no sign-up", text: "No email, no password to make, no ads." },
    { icon: CandlestickChart, title: "Stocks, options and futures", text: "Log trades, see your stats and calendar, and export to Excel any time." },
  ];
  return (
    <Shell>
      <div className="mb-8 text-center">
        <SpyBadge size={132} className="mx-auto mb-5" />
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to your {APP_NAME}</h1>
        {COMMUNITY_NAME && <p className="mt-1 text-sm text-text-muted">Made for {COMMUNITY_NAME} members</p>}
      </div>
      <div className="space-y-3">
        {points.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex gap-3 rounded-xl border border-border-strong bg-surface-1 p-4">
            <Icon size={20} className="mt-0.5 shrink-0 text-good-text" />
            <div>
              <div className="text-sm font-semibold">{title}</div>
              <div className="mt-0.5 text-sm text-text-muted">{text}</div>
            </div>
          </div>
        ))}
      </div>
      <Button variant="primary" size="lg" className="mt-6 w-full" onClick={finishWelcome}>
        Start my journal
      </Button>
      <button type="button" onClick={() => setRestoring(true)} className="mt-4 w-full text-center text-sm text-text-muted underline-offset-4 hover:text-text-primary hover:underline">
        Moving from another computer? Open a backup file
      </button>
      <Modal open={restoring} onClose={() => setRestoring(false)} title="Open a backup file">
        <RestoreFlow
          onDone={async () => {
            setRestoring(false);
            await finishWelcome();
            await reload();
          }}
        />
      </Modal>
    </Shell>
  );
}

export function LockScreen() {
  const { unlocked } = useJournal();
  const [mode, setMode] = useState<"pass" | "recovery">("pass");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [erase, setErase] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setWrong(false);
    const ok = mode === "pass" ? await unlock(value) : await unlockWithRecovery(value);
    setBusy(false);
    if (ok) {
      await unlocked();
      if (mode === "recovery") location.hash = "#/protect?reset=1";
    } else {
      setWrong(true);
      setValue("");
      inputRef.current?.focus();
    }
  };

  return (
    <Shell>
      <div className="mb-6 text-center">
        <SpyBadge size={96} className="mx-auto mb-4" />
        <h1 className="text-2xl font-semibold tracking-tight">{APP_NAME} is locked</h1>
        <p className="mt-1 text-sm text-text-muted">
          {mode === "pass" ? "Enter your passcode to open your journal." : "Enter the recovery code you saved when you set your passcode."}
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <Input
          ref={inputRef}
          autoFocus
          type={mode === "pass" ? "password" : "text"}
          autoComplete={mode === "pass" ? "current-password" : "off"}
          placeholder={mode === "pass" ? "Passcode" : "XXXXX-XXXXX-XXXXX-XXXXX"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="py-3 text-base"
          aria-invalid={wrong}
        />
        {wrong && <p className="text-sm text-critical-text">{mode === "pass" ? "That passcode isn't right. Try again." : "That recovery code isn't right. Check each letter."}</p>}
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy && <Loader2 size={16} className="animate-spin" />} Unlock
        </Button>
      </form>
      <div className="mt-5 space-y-2 text-center text-sm">
        <button
          type="button"
          onClick={() => { setMode(mode === "pass" ? "recovery" : "pass"); setValue(""); setWrong(false); }}
          className="text-text-muted underline-offset-4 hover:text-text-primary hover:underline"
        >
          {mode === "pass" ? "Forgot your passcode? Use your recovery code" : "Use my passcode instead"}
        </button>
        {mode === "recovery" && (
          <div>
            <button type="button" onClick={() => setErase(true)} className="text-xs text-text-muted underline-offset-4 hover:text-critical-text hover:underline">
              Lost both? Start over with an empty journal
            </button>
          </div>
        )}
      </div>
      <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-text-muted">
        <ShieldCheck size={13} className="text-good-text" /> Your journal is encrypted on this computer.
      </div>
      <EraseModal open={erase} onClose={() => setErase(false)} />
    </Shell>
  );
}

export function EraseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [typed, setTyped] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="Erase this journal?">
      <p className="text-sm text-text-secondary">
        This permanently deletes every trade and screenshot saved in this browser. It can't be undone. If you have a backup file, you can open it afterward.
      </p>
      <p className="mt-4 text-sm text-text-secondary">
        Type <span className="font-semibold text-text-primary">ERASE</span> to confirm.
      </p>
      <Input className="mt-2" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="danger"
          disabled={typed.trim().toUpperCase() !== "ERASE"}
          onClick={async () => {
            await eraseEverything();
            location.hash = "#/";
            location.reload();
          }}
        >
          Erase everything
        </Button>
      </div>
    </Modal>
  );
}
