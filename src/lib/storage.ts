// Everything is saved in this browser's IndexedDB on the member's own computer. Nothing is sent anywhere.
// When a passcode is on, every record is encrypted before it is written (see crypto.ts).

import { openDB, type IDBPDatabase } from "idb";
import {
  newDataKey,
  wrapDataKey,
  unwrapDataKey,
  sealJson,
  openJson,
  sealBytes,
  openBytes,
  newRecoveryCode,
  normalizeRecoveryCode,
  type WrappedKey,
  type Sealed,
} from "./crypto";
import { DEFAULT_SETTINGS, type Lists, type Settings, type Trade } from "./types";

const DB_NAME = "trade-journal";

/** A record is either plain or sealed. */
type Stored = { enc: false; value: unknown } | { enc: true; iv: Uint8Array<ArrayBuffer>; ct: ArrayBuffer };
type StoredImage = {
  tradeId: string;
  type: string;
  createdAt: string;
  enc: boolean;
  iv?: Uint8Array<ArrayBuffer>;
  data: Blob | ArrayBuffer;
};

export type VaultInfo = { passcode: WrappedKey; recovery: WrappedKey; createdAt: string };

type Schema = {
  trades: { key: string; value: Stored };
  kv: { key: string; value: Stored };
  images: { key: string; value: StoredImage };
  meta: { key: string; value: unknown };
};

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;
function db() {
  dbPromise ??= openDB<Schema>(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore("trades");
      d.createObjectStore("kv");
      d.createObjectStore("images");
      d.createObjectStore("meta");
    },
  });
  return dbPromise;
}

/** Only for tests: forget the open connection. */
export async function _resetForTests() {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
  dataKey = null;
}

// The unlocked data key lives only in memory, only while the journal is open and unlocked.
let dataKey: CryptoKey | null = null;

export async function getVault(): Promise<VaultInfo | null> {
  return ((await (await db()).get("meta", "vault")) as VaultInfo | undefined) ?? null;
}

export async function hasPasscode() {
  return (await getVault()) !== null;
}

export function isUnlocked() {
  return dataKey !== null;
}

export async function unlock(passcode: string): Promise<boolean> {
  const v = await getVault();
  if (!v) return true;
  const key = await unwrapDataKey(v.passcode, passcode);
  if (!key) return false;
  dataKey = key;
  return true;
}

export async function unlockWithRecovery(code: string): Promise<boolean> {
  const v = await getVault();
  if (!v) return true;
  const key = await unwrapDataKey(v.recovery, normalizeRecoveryCode(code));
  if (!key) return false;
  dataKey = key;
  return true;
}

export function lock() {
  dataKey = null;
}

async function seal(value: unknown): Promise<Stored> {
  if (!dataKey) return { enc: false, value };
  const s = await sealJson(dataKey, value);
  return { enc: true, iv: s.iv, ct: s.ct };
}

async function unseal<T>(s: Stored): Promise<T> {
  if (!s.enc) return s.value as T;
  if (!dataKey) throw new Error("LOCKED");
  return openJson<T>(dataKey, { iv: s.iv, ct: s.ct });
}

async function requireOpen() {
  if ((await hasPasscode()) && !dataKey) throw new Error("LOCKED");
}

// ---------- Trades, lists, settings ----------

export type Journal = { trades: Trade[]; lists: Lists; settings: Settings };

export async function loadJournal(): Promise<Journal> {
  await requireOpen();
  const d = await db();
  const stored = await d.getAll("trades");
  const trades = await Promise.all(stored.map((s) => unseal<Trade>(s)));
  const listsRec = await d.get("kv", "lists");
  const settingsRec = await d.get("kv", "settings");
  const lists = listsRec ? await unseal<Lists>(listsRec) : { strategies: [], accounts: [] };
  const settings = settingsRec ? { ...DEFAULT_SETTINGS, ...(await unseal<Settings>(settingsRec)) } : DEFAULT_SETTINGS;
  return { trades, lists, settings };
}

export async function saveTrade(t: Trade) {
  await requireOpen();
  await (await db()).put("trades", await seal(t), t.id);
}

export async function saveTrades(ts: Trade[]) {
  await requireOpen();
  const sealed = await Promise.all(ts.map(async (t) => [t.id, await seal(t)] as const));
  const tx = (await db()).transaction("trades", "readwrite");
  for (const [id, s] of sealed) tx.store.put(s, id);
  await tx.done;
}

export async function deleteTrade(t: Trade) {
  const tx = (await db()).transaction(["trades", "images"], "readwrite");
  tx.objectStore("trades").delete(t.id);
  for (const id of t.screenshotIds) tx.objectStore("images").delete(id);
  await tx.done;
}

export async function saveLists(lists: Lists) {
  await requireOpen();
  await (await db()).put("kv", await seal(lists), "lists");
}

export async function saveSettings(settings: Settings) {
  await requireOpen();
  await (await db()).put("kv", await seal(settings), "settings");
}

// ---------- Screenshots ----------

export async function saveImage(id: string, tradeId: string, blob: Blob) {
  await requireOpen();
  const base = { tradeId, type: blob.type || "image/png", createdAt: new Date().toISOString() };
  let rec: StoredImage;
  if (dataKey) {
    const s = await sealBytes(dataKey, await blob.arrayBuffer());
    rec = { ...base, enc: true, iv: s.iv, data: s.ct };
  } else {
    rec = { ...base, enc: false, data: blob };
  }
  await (await db()).put("images", rec, id);
}

export async function getImage(id: string): Promise<Blob | null> {
  const rec = await (await db()).get("images", id);
  if (!rec) return null;
  if (!rec.enc) return rec.data as Blob;
  if (!dataKey) throw new Error("LOCKED");
  const bytes = await openBytes(dataKey, { iv: rec.iv!, ct: rec.data as ArrayBuffer });
  return new Blob([bytes], { type: rec.type });
}

export async function deleteImages(ids: string[]) {
  const tx = (await db()).transaction("images", "readwrite");
  for (const id of ids) tx.store.delete(id);
  await tx.done;
}

// ---------- Passcode on / off / change ----------

type Snapshot = {
  trades: [string, unknown][];
  kv: [string, unknown][];
  images: [string, { tradeId: string; type: string; createdAt: string; bytes: ArrayBuffer }][];
};

/** Reads and decrypts everything into memory (journals are small: thousands of trades, not millions). */
async function snapshot(): Promise<Snapshot> {
  await requireOpen();
  const d = await db();
  const read = async (store: "trades" | "kv") => {
    const keys = (await d.getAllKeys(store)) as string[];
    const vals = await d.getAll(store);
    return Promise.all(keys.map(async (k, i) => [k, await unseal(vals[i])] as [string, unknown]));
  };
  const imgKeys = (await d.getAllKeys("images")) as string[];
  const images: Snapshot["images"] = [];
  for (const id of imgKeys) {
    const rec = (await d.get("images", id))!;
    const blob = await getImage(id);
    if (blob) images.push([id, { tradeId: rec.tradeId, type: rec.type, createdAt: rec.createdAt, bytes: await blob.arrayBuffer() }]);
  }
  return { trades: await read("trades"), kv: await read("kv"), images };
}

/** Rewrites every record with the current key (or plain if none), plus the vault record, in ONE transaction. */
async function rewrite(snap: Snapshot, vault: VaultInfo | null) {
  const trades = await Promise.all(snap.trades.map(async ([k, v]) => [k, await seal(v)] as const));
  const kv = await Promise.all(snap.kv.map(async ([k, v]) => [k, await seal(v)] as const));
  const images = await Promise.all(
    snap.images.map(async ([id, im]) => {
      const base = { tradeId: im.tradeId, type: im.type, createdAt: im.createdAt };
      if (dataKey) {
        const s: Sealed = await sealBytes(dataKey, im.bytes);
        return [id, { ...base, enc: true, iv: s.iv, data: s.ct }] as const;
      }
      return [id, { ...base, enc: false, data: new Blob([im.bytes], { type: im.type }) }] as const;
    })
  );
  const tx = (await db()).transaction(["trades", "kv", "images", "meta"], "readwrite");
  const ts = tx.objectStore("trades");
  const ks = tx.objectStore("kv");
  const is = tx.objectStore("images");
  const ms = tx.objectStore("meta");
  ts.clear();
  ks.clear();
  is.clear();
  for (const [k, v] of trades) ts.put(v, k);
  for (const [k, v] of kv) ks.put(v, k);
  for (const [k, v] of images) is.put(v as StoredImage, k);
  if (vault) ms.put(vault, "vault");
  else ms.delete("vault");
  await tx.done;
}

/** Turns on the passcode. Returns the recovery code to show the member ONCE. */
export async function setPasscode(passcode: string): Promise<string> {
  if (await hasPasscode()) throw new Error("A passcode is already set.");
  const snap = await snapshot();
  const key = await newDataKey();
  const recoveryCode = newRecoveryCode();
  const vault: VaultInfo = {
    passcode: await wrapDataKey(key, passcode),
    recovery: await wrapDataKey(key, recoveryCode),
    createdAt: new Date().toISOString(),
  };
  dataKey = key;
  try {
    await rewrite(snap, vault);
  } catch (e) {
    dataKey = null; // nothing was written (single transaction), so the journal is still plain
    throw e;
  }
  return recoveryCode;
}

/** Changes the passcode (must be unlocked). The recovery code stays the same. */
export async function changePasscode(newPasscode: string) {
  const v = await getVault();
  if (!v || !dataKey) throw new Error("LOCKED");
  const next: VaultInfo = { ...v, passcode: await wrapDataKey(dataKey, newPasscode) };
  await (await db()).put("meta", next, "vault");
}

/** Makes a new recovery code (e.g. if the old one was lost). The old one stops working. */
export async function newRecovery(): Promise<string> {
  const v = await getVault();
  if (!v || !dataKey) throw new Error("LOCKED");
  const code = newRecoveryCode();
  await (await db()).put("meta", { ...v, recovery: await wrapDataKey(dataKey, code) }, "vault");
  return code;
}

/** Turns the passcode off: decrypts everything back to plain storage. */
export async function removePasscode() {
  const snap = await snapshot();
  const keep = dataKey;
  dataKey = null;
  try {
    await rewrite(snap, null);
  } catch (e) {
    dataKey = keep;
    throw e;
  }
}

// ---------- Whole-journal operations (backup / restore / erase) ----------

export type PlainExport = {
  trades: Trade[];
  lists: Lists;
  settings: Settings;
  images: { id: string; tradeId: string; type: string; createdAt: string; bytes: ArrayBuffer }[];
};

export async function exportAll(): Promise<PlainExport> {
  const j = await loadJournal();
  const snap = await snapshot();
  return { ...j, images: snap.images.map(([id, im]) => ({ id, ...im })) };
}

/** Replaces everything on this device with `data`. If `vault`+`key` are given, the journal is protected by them. */
export async function replaceAll(data: PlainExport, vault: VaultInfo | null, key: CryptoKey | null) {
  dataKey = key;
  const snap: Snapshot = {
    trades: data.trades.map((t) => [t.id, t]),
    kv: [
      ["lists", data.lists],
      ["settings", data.settings],
    ],
    images: data.images.map((im) => [im.id, { tradeId: im.tradeId, type: im.type, createdAt: im.createdAt, bytes: im.bytes }]),
  };
  await rewrite(snap, vault);
}

export function currentKey() {
  return dataKey;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get("meta", key)) as T | undefined;
}

export async function setMeta(key: string, value: unknown) {
  await (await db()).put("meta", value, key);
}

export async function eraseEverything() {
  const tx = (await db()).transaction(["trades", "kv", "images", "meta"], "readwrite");
  await Promise.all([
    tx.objectStore("trades").clear(),
    tx.objectStore("kv").clear(),
    tx.objectStore("images").clear(),
    tx.objectStore("meta").clear(),
    tx.done,
  ]);
  dataKey = null;
}
