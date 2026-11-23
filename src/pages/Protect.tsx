import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { ShieldCheck, KeyRound, HardDriveDownload, FileSpreadsheet, Trash2, Loader2, Copy, Check, Download, FolderOpen, Lock, EyeOff, WifiOff, Laptop } from "lucide-react";
import { useJournal } from "../lib/journal";
import { setPasscode, changePasscode, newRecovery, removePasscode } from "../lib/storage";
import { autoBackupSupported, chooseAutoBackupFile, stopAutoBackup } from "../lib/backup";
import { daysAgo } from "../lib/format";
import { Button, Card, Field, Input, Modal, Notice, PageHeader, Select } from "../components/ui";
import { BackupButton } from "../components/BackupButton";
import { RestoreFlow } from "../components/RestoreFlow";
import { EraseModal } from "./Gates";
import { ExcelButton } from "./Views";
import { downloadBlob } from "../lib/excel";

export function Protect() {
  const j = useJournal();
  const [sp, setSp] = useSearchParams();
  const [modal, setModal] = useState<null | "set" | "change" | "remove" | "restore" | "erase" | "newcode">(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  // Arrived here after unlocking with a recovery code → offer to pick a new passcode.
  useEffect(() => {
    if (sp.get("reset") === "1" && j.passcodeOn) {
      setModal("change");
      setSp({}, { replace: true });
    }
  }, [sp, setSp, j.passcodeOn]);

  const age = daysAgo(j.lastBackup);
  const lastText = j.lastBackup ? (age === 0 ? "today" : age === 1 ? "yesterday" : `${age} days ago`) : "never";

  return (
    <>
      <PageHeader title="Backup & Privacy" sub="Keep your journal safe and private." />
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-5 md:px-8">
        <Card title={<span className="flex items-center gap-2"><ShieldCheck size={16} className="text-good-text" /> How your data is kept private</span>}>
          <ul className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {[
              { icon: Laptop, t: "Saved only on this computer", d: "Your trades are stored inside this web browser, on this device." },
              { icon: WifiOff, t: "Never sent anywhere", d: "There's no server and no account. This site is blocked from sending your data out." },
              { icon: EyeOff, t: "No tracking", d: "No ads, no analytics, no cookies. Nobody can see your trades, including us." },
              { icon: Lock, t: "Optional passcode", d: "Scrambles (encrypts) your journal so only your passcode can open it." },
            ].map(({ icon: Icon, t, d }) => (
              <li key={t} className="flex gap-2.5">
                <Icon size={16} className="mt-0.5 shrink-0 text-accent" />
                <span><span className="font-medium text-text-primary">{t}.</span> <span className="text-text-muted">{d}</span></span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={<span className="flex items-center gap-2"><KeyRound size={16} /> Passcode</span>}>
          {j.passcodeOn ? (
            <div className="space-y-4">
              <Notice tone="good" icon={<Lock size={16} />}>Your journal is locked with a passcode and encrypted on this computer.</Notice>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Lock automatically after" hint="How long you can be away before it asks for your passcode again.">
                  <Select value={j.settings.autoLockMinutes} onChange={(e) => j.saveSettings({ ...j.settings, autoLockMinutes: Number(e.target.value) })}>
                    {[5, 15, 30, 60, 240].map((m) => <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? "s" : ""}`}</option>)}
                    <option value={0}>Never (only when I click Lock)</option>
                  </Select>
                </Field>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setModal("change")}>Change passcode</Button>
                <Button onClick={() => setModal("newcode")}>Get a new recovery code</Button>
                <Button variant="ghost" onClick={() => setModal("remove")}>Turn off passcode</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">Anyone using this computer can open your journal right now. Add a passcode if you share this computer or want extra privacy.</p>
              <Button variant="primary" onClick={() => setModal("set")}><KeyRound size={15} /> Set a passcode</Button>
            </div>
          )}
        </Card>

        <Card title={<span className="flex items-center gap-2"><HardDriveDownload size={16} /> Backups</span>}>
          <div className="space-y-4 text-sm">
            <p className="text-text-secondary">
              Your journal lives in this browser. If the browser's data is ever cleared, or you get a new computer, a backup file brings everything back, screenshots included.
              {j.passcodeOn && " Backups are locked with your passcode too."}
            </p>
            {autoBackupSupported() && (
              <div className="rounded-xl border border-border-strong bg-surface-2 p-4">
                <div className="font-medium">Automatic backup {j.autoBackup.file ? <span className="text-good-text">is on</span> : <span className="text-text-muted">(recommended)</span>}</div>
                {j.autoBackup.file ? (
                  <>
                    <p className="mt-1 text-text-muted">Every change is saved to <b className="text-text-primary">{j.autoBackup.file}</b> on your computer.</p>
                    {j.autoBackup.state === "needs-permission" && <p className="mt-1 text-warn-text">Your browser needs permission again.</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {j.autoBackup.state === "needs-permission" && <Button size="sm" variant="primary" onClick={() => j.backupNow(true)}>Allow</Button>}
                      <Button size="sm" onClick={async () => { await chooseAutoBackupFile(); await j.refreshBackupInfo(); }}><FolderOpen size={13} /> Change file</Button>
                      <Button size="sm" variant="ghost" onClick={async () => { await stopAutoBackup(); await j.refreshBackupInfo(); }}>Turn off</Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-text-muted">Pick a spot (like your Documents folder) and your journal will keep a backup file there up to date by itself.</p>
                    <Button size="sm" variant="primary" className="mt-3" onClick={async () => { await chooseAutoBackupFile(); await j.refreshBackupInfo(); }}><FolderOpen size={13} /> Choose where to save</Button>
                  </>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <BackupButton />
              <Button onClick={() => setModal("restore")}><FolderOpen size={14} /> Open a backup file</Button>
              <span className="text-xs text-text-muted">Last backup: {lastText}</span>
            </div>
            {j.persisted === false && (
              <Notice>
                Tip: bookmark this page (or add it to your Dock or Home Screen) and keep a recent backup. That way your journal is always safe.
              </Notice>
            )}
          </div>
        </Card>

        <Card title={<span className="flex items-center gap-2"><FileSpreadsheet size={16} /> Excel</span>}>
          <p className="mb-3 text-sm text-text-secondary">
            Download all {j.trades.length} trade{j.trades.length === 1 ? "" : "s"} as an Excel file with Trades, Fills, Summary and Daily P&L tabs.
            {j.passcodeOn && " Note: the Excel file isn't locked with your passcode."}
          </p>
          <ExcelButton rows={j.rows} label="Download Excel file" />
        </Card>

        <Card title={<span className="flex items-center gap-2 text-critical-text"><Trash2 size={16} /> Erase this journal</span>}>
          <p className="mb-3 text-sm text-text-secondary">Deletes every trade on this computer. Download a backup first if you might want them later.</p>
          <Button variant="ghost" className="text-critical-text" onClick={() => setModal("erase")}>Erase everything…</Button>
        </Card>
      </div>

      <Modal open={modal === "set"} onClose={() => setModal(null)} title="Set a passcode">
        <PasscodeForm
          submitLabel="Lock my journal"
          onSubmit={async (p) => {
            const code = await setPasscode(p);
            await j.reload();
            setModal(null);
            setRecoveryCode(code);
          }}
        />
      </Modal>
      <Modal open={modal === "change"} onClose={() => setModal(null)} title="Choose a new passcode">
        <PasscodeForm submitLabel="Save new passcode" onSubmit={async (p) => { await changePasscode(p); setModal(null); }} />
      </Modal>
      <Modal open={modal === "newcode"} onClose={() => setModal(null)} title="Get a new recovery code?">
        <p className="text-sm text-text-secondary">Your old recovery code will stop working. Backups you already made still open with the old code or your passcode from that time.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="primary" onClick={async () => { const c = await newRecovery(); setModal(null); setRecoveryCode(c); }}>Make a new code</Button>
        </div>
      </Modal>
      <Modal open={modal === "remove"} onClose={() => setModal(null)} title="Turn off the passcode?">
        <p className="text-sm text-text-secondary">Your journal will open without a passcode, and it won't be encrypted on this computer anymore.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => setModal(null)}>Keep it on</Button>
          <Button variant="danger" onClick={async () => { await removePasscode(); await j.reload(); setModal(null); }}>Turn off</Button>
        </div>
      </Modal>
      <Modal open={modal === "restore"} onClose={() => setModal(null)} title="Open a backup file">
        <RestoreFlow currentTradeCount={j.trades.length} onDone={async () => { setModal(null); await j.reload(); }} />
      </Modal>
      <EraseModal open={modal === "erase"} onClose={() => setModal(null)} />
      <RecoveryCodeModal code={recoveryCode} onClose={() => setRecoveryCode(null)} />
    </>
  );
}

function PasscodeForm({ onSubmit, submitLabel }: { onSubmit: (p: string) => Promise<void>; submitLabel: string }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (a.length < 6) return setErr("Use at least 6 characters.");
        if (a !== b) return setErr("The two passcodes don't match.");
        setErr(null);
        setBusy(true);
        try {
          await onSubmit(a);
        } catch {
          setErr("Something went wrong. Nothing was changed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Passcode" hint="At least 6 characters. A short phrase is easy to remember.">
        <Input type="password" autoFocus autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} />
      </Field>
      <Field label="Type it again">
        <Input type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} />
      </Field>
      {err && <p className="text-sm text-critical-text">{err}</p>}
      <Button type="submit" variant="primary" className="w-full" disabled={busy}>
        {busy && <Loader2 size={14} className="animate-spin" />} {submitLabel}
      </Button>
    </form>
  );
}

function RecoveryCodeModal({ code, onClose }: { code: string | null; onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setSaved(false); setCopied(false); }, [code]);
  return (
    <Modal open={!!code} onClose={() => saved && onClose()} title="Save your recovery code">
      <p className="text-sm text-text-secondary">
        If you ever forget your passcode, this code is the <b className="text-text-primary">only</b> other way to open your journal. Nobody can reset it for you. Write it down or save it somewhere safe.
      </p>
      <div className="my-4 select-all rounded-xl border border-border-strong bg-surface-0 px-4 py-4 text-center font-mono text-lg font-semibold tracking-wider">{code}</div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={async () => { await navigator.clipboard.writeText(code ?? ""); setCopied(true); }}>
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
        </Button>
        <Button size="sm" onClick={() => downloadBlob(new Blob([`Trade Journal recovery code\n\n${code}\n\nKeep this somewhere safe. It opens your journal if you forget your passcode.\n`], { type: "text/plain" }), "trade-journal-recovery-code.txt")}>
          <Download size={13} /> Save as file
        </Button>
      </div>
      <label className="mt-5 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
        I saved my recovery code
      </label>
      <Button variant="primary" className="mt-4 w-full" disabled={!saved} onClick={onClose}>Done</Button>
    </Modal>
  );
}
