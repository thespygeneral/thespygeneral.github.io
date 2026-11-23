// One backup file = the whole journal (trades, screenshots, lists, settings).
// If the journal has a passcode, the backup is encrypted too and opens with the same passcode or recovery code.

import { toB64, fromB64, sealJson, openJson, unwrapDataKey, normalizeRecoveryCode } from "./crypto";
import {
  exportAll,
  replaceAll,
  getVault,
  currentKey,
  getMeta,
  setMeta,
  type PlainExport,
  type VaultInfo,
} from "./storage";

export const BACKUP_FORMAT = "trade-journal-backup";

type Payload = Omit<PlainExport, "images"> & {
  images: { id: string; tradeId: string; type: string; createdAt: string; b64: string }[];
};

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: 1;
  createdAt: string;
  tradeCount: number;
  protected: boolean;
  vault?: VaultInfo;
  iv?: string;
  data: string | Payload; // base64 ciphertext when protected, plain object otherwise
};

export async function makeBackup(): Promise<Blob> {
  const all = await exportAll();
  const payload: Payload = {
    trades: all.trades,
    lists: all.lists,
    settings: all.settings,
    images: all.images.map(({ bytes, ...rest }) => ({ ...rest, b64: toB64(bytes) })),
  };
  const vault = await getVault();
  const key = currentKey();
  const base = { format: BACKUP_FORMAT as typeof BACKUP_FORMAT, version: 1 as const, createdAt: new Date().toISOString(), tradeCount: all.trades.length };
  let file: BackupFile;
  if (vault && key) {
    const sealed = await sealJson(key, payload);
    file = { ...base, protected: true, vault, iv: toB64(sealed.iv), data: toB64(sealed.ct) };
  } else {
    file = { ...base, protected: false, data: payload };
  }
  return new Blob([JSON.stringify(file)], { type: "application/json" });
}

export function backupFileName(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `trade-journal-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

export type ReadBackup =
  | { ok: true; file: BackupFile }
  | { ok: false; reason: string };

export async function readBackupFile(f: File): Promise<ReadBackup> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await f.text());
  } catch {
    return { ok: false, reason: "This isn't a journal backup file." };
  }
  const b = parsed as Partial<BackupFile>;
  if (b?.format !== BACKUP_FORMAT || b.version !== 1 || !b.data) {
    return { ok: false, reason: "This isn't a journal backup file." };
  }
  return { ok: true, file: b as BackupFile };
}

/**
 * Restores a backup over everything on this device.
 * `secret` is the passcode or recovery code (only needed for protected backups).
 * Returns false if the secret is wrong.
 */
export async function restoreBackup(file: BackupFile, secret?: string): Promise<boolean> {
  let payload: Payload;
  let vault: VaultInfo | null = null;
  let key: CryptoKey | null = null;

  if (file.protected) {
    if (!file.vault || !file.iv || typeof file.data !== "string" || !secret) return false;
    key =
      (await unwrapDataKey(file.vault.passcode, secret)) ??
      (await unwrapDataKey(file.vault.recovery, normalizeRecoveryCode(secret)));
    if (!key) return false;
    payload = await openJson<Payload>(key, { iv: fromB64(file.iv), ct: fromB64(file.data).buffer });
    vault = file.vault;
  } else {
    payload = file.data as Payload;
    // Restoring an unprotected backup onto a protected journal keeps this device's passcode.
    const deviceVault = await getVault();
    if (deviceVault && currentKey()) {
      vault = deviceVault;
      key = currentKey();
    }
  }

  await replaceAll(
    {
      trades: payload.trades ?? [],
      lists: payload.lists ?? { strategies: [], accounts: [] },
      settings: payload.settings,
      images: (payload.images ?? []).map(({ b64, ...rest }) => ({ ...rest, bytes: fromB64(b64).buffer })),
    },
    vault,
    key
  );
  return true;
}

// ---------- Backup bookkeeping + automatic backup file (Chrome / Edge) ----------

export async function lastBackupAt(): Promise<string | null> {
  return (await getMeta<string>("lastBackupAt")) ?? null;
}

export async function markBackedUp() {
  await setMeta("lastBackupAt", new Date().toISOString());
}

type SaveFilePicker = (opts: unknown) => Promise<FileSystemFileHandle>;
type PermissionHandle = FileSystemFileHandle & {
  queryPermission?: (o: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: "readwrite" }) => Promise<PermissionState>;
};

/** True in browsers that can keep a backup file up to date by themselves (Chrome, Edge, Brave, Opera). */
export function autoBackupSupported(): boolean {
  return typeof window !== "undefined" && "showSaveFilePicker" in window;
}

export async function chooseAutoBackupFile(): Promise<boolean> {
  const picker = (window as unknown as { showSaveFilePicker: SaveFilePicker }).showSaveFilePicker;
  try {
    const handle = await picker({
      suggestedName: "trade-journal-backup.json",
      startIn: "documents",
      types: [{ description: "Journal backup", accept: { "application/json": [".json"] } }],
    });
    await setMeta("autoBackupHandle", handle);
    await writeAutoBackup(true);
    return true;
  } catch {
    return false; // member closed the dialog
  }
}

export async function autoBackupFileName(): Promise<string | null> {
  const h = await getMeta<FileSystemFileHandle>("autoBackupHandle");
  return h?.name ?? null;
}

export async function stopAutoBackup() {
  await setMeta("autoBackupHandle", undefined);
}

/** "ok" = written; "needs-permission" = browser wants one click to allow it again; "off" = not set up. */
export async function writeAutoBackup(userClicked = false): Promise<"ok" | "needs-permission" | "off" | "error"> {
  const handle = (await getMeta<PermissionHandle>("autoBackupHandle")) ?? null;
  if (!handle) return "off";
  try {
    let perm = (await handle.queryPermission?.({ mode: "readwrite" })) ?? "granted";
    if (perm !== "granted" && userClicked) perm = (await handle.requestPermission?.({ mode: "readwrite" })) ?? "denied";
    if (perm !== "granted") return "needs-permission";
    const w = await handle.createWritable();
    await w.write(await makeBackup());
    await w.close();
    await markBackedUp();
    return "ok";
  } catch {
    return "error";
  }
}
