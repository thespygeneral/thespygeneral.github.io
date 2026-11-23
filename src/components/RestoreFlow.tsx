import { useRef, useState } from "react";
import { FileUp, Loader2, Lock } from "lucide-react";
import { Button, Input, Notice } from "./ui";
import { readBackupFile, restoreBackup, type BackupFile } from "../lib/backup";

/** Pick a backup file → (passcode if it's locked) → replace this journal with it. */
export function RestoreFlow({ onDone, currentTradeCount = 0 }: { onDone: () => void; currentTradeCount?: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<BackupFile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setErr(null);
    const r = await readBackupFile(f);
    if (!r.ok) return setErr(r.reason);
    setFile(r.file);
  };

  const go = async () => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const ok = await restoreBackup(file, secret || undefined);
      if (!ok) {
        setErr("That passcode or recovery code doesn't open this backup.");
        return;
      }
      onDone();
    } catch {
      setErr("Something went wrong reading that file. Your current journal was not changed.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">Choose the backup file you saved earlier. Its name starts with <span className="font-medium text-text-primary">trade-journal-backup</span>.</p>
        <Button variant="primary" className="w-full" onClick={() => inputRef.current?.click()}>
          <FileUp size={16} /> Choose backup file
        </Button>
        <input ref={inputRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        {err && <p className="text-sm text-critical-text">{err}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border-strong bg-surface-2 p-3 text-sm">
        <div className="font-medium">Backup from {new Date(file.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
        <div className="text-text-muted">{file.tradeCount} trade{file.tradeCount === 1 ? "" : "s"}{file.protected ? " · locked with a passcode" : ""}</div>
      </div>
      {file.protected && (
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-secondary"><Lock size={12} /> Passcode or recovery code for this backup</span>
          <Input type="password" autoFocus value={secret} onChange={(e) => setSecret(e.target.value)} />
        </label>
      )}
      {currentTradeCount > 0 && (
        <Notice tone="warn">
          This replaces the {currentTradeCount} trade{currentTradeCount === 1 ? "" : "s"} in this journal with the ones in the backup.
        </Notice>
      )}
      {err && <p className="text-sm text-critical-text">{err}</p>}
      <div className="flex justify-end gap-2">
        <Button onClick={() => { setFile(null); setSecret(""); setErr(null); }}>Back</Button>
        <Button variant="primary" onClick={go} disabled={busy || (file.protected && !secret)}>
          {busy && <Loader2 size={14} className="animate-spin" />} Open backup
        </Button>
      </div>
    </div>
  );
}
