import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as S from "./storage";
import { writeAutoBackup, autoBackupFileName, lastBackupAt } from "./backup";
import { DEFAULT_SETTINGS, EMPTY_LISTS, PRESET_MISTAKES, type Lists, type Settings, type Trade } from "./types";
import { rows as toRows, type TradeRow } from "./calc";

type Phase = "loading" | "welcome" | "locked" | "ready" | "error";
type AutoState = "off" | "ok" | "needs-permission" | "error";

type Ctx = {
  phase: Phase;
  error: string | null;
  trades: Trade[];
  rows: TradeRow[];
  lists: Lists;
  settings: Settings;
  passcodeOn: boolean;
  persisted: boolean | null;
  lastBackup: string | null;
  autoBackup: { file: string | null; state: AutoState };
  saveTrade: (t: Trade, newImages?: { id: string; blob: Blob }[], removedImageIds?: string[]) => Promise<void>;
  deleteTrade: (t: Trade) => Promise<void>;
  addTrades: (ts: Trade[]) => Promise<void>;
  saveLists: (l: Lists) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  /** Re-read everything from storage (after restore, passcode change, other tab edits). */
  reload: () => Promise<void>;
  finishWelcome: () => Promise<void>;
  lockNow: () => void;
  unlocked: () => Promise<void>;
  refreshBackupInfo: () => Promise<void>;
  backupNow: (userClicked?: boolean) => Promise<AutoState>;
};

const JournalContext = createContext<Ctx | null>(null);
export const useJournal = () => {
  const c = useContext(JournalContext);
  if (!c) throw new Error("useJournal outside provider");
  return c;
};

const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("trade-journal") : null;

export function JournalProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [lists, setLists] = useState<Lists>(EMPTY_LISTS);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [passcodeOn, setPasscodeOn] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [autoBackup, setAutoBackup] = useState<{ file: string | null; state: AutoState }>({ file: null, state: "off" });
  const backupTimer = useRef<number | undefined>(undefined);

  const refreshBackupInfo = useCallback(async () => {
    setLastBackup(await lastBackupAt());
    const file = await autoBackupFileName();
    setAutoBackup((a) => ({ file, state: file ? (a.state === "off" ? "ok" : a.state) : "off" }));
  }, []);

  const load = useCallback(async () => {
    try {
      const pc = await S.hasPasscode();
      setPasscodeOn(pc);
      if (pc && !S.isUnlocked()) {
        setPhase("locked");
        return;
      }
      const j = await S.loadJournal();
      setTrades(j.trades);
      setLists(j.lists);
      setSettings(j.settings);
      await refreshBackupInfo();
      const welcomed = await S.getMeta<boolean>("welcomed");
      setPhase(!welcomed && j.trades.length === 0 ? "welcome" : "ready");
    } catch (e) {
      if (e instanceof Error && e.message === "LOCKED") return setPhase("locked");
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, [refreshBackupInfo]);

  useEffect(() => {
    load();
    // Ask the browser to never clear this site's data to free up space.
    (async () => {
      try {
        if (!navigator.storage?.persisted) return setPersisted(null);
        let p = await navigator.storage.persisted();
        if (!p && navigator.storage.persist) p = await navigator.storage.persist();
        setPersisted(p);
      } catch {
        setPersisted(null);
      }
    })();
  }, [load]);

  // Another tab changed something → re-read.
  useEffect(() => {
    if (!channel) return;
    const onMsg = (e: MessageEvent) => {
      if (e.data === "changed") load();
      if (e.data === "locked" && S.isUnlocked() === false) setPhase("locked");
    };
    channel.addEventListener("message", onMsg);
    return () => channel.removeEventListener("message", onMsg);
  }, [load]);

  const backupNow = useCallback(async (userClicked = false) => {
    const r = await writeAutoBackup(userClicked);
    setAutoBackup((a) => ({ ...a, state: r === "off" ? "off" : r }));
    if (r === "ok") setLastBackup(new Date().toISOString());
    return r;
  }, []);

  const changed = useCallback(() => {
    channel?.postMessage("changed");
    window.clearTimeout(backupTimer.current);
    backupTimer.current = window.setTimeout(() => backupNow(), 2500);
  }, [backupNow]);

  const lockNow = useCallback(() => {
    S.lock();
    clearImageCache();
    setTrades([]);
    setPhase("locked");
  }, []);

  // Auto-lock after inactivity (only when a passcode is on).
  useEffect(() => {
    if (!passcodeOn || phase !== "ready" || !settings.autoLockMinutes) return;
    const limit = settings.autoLockMinutes * 60_000;
    let last = Date.now();
    const bump = () => (last = Date.now());
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((ev) => window.addEventListener(ev, bump, { passive: true }));
    const check = () => {
      if (Date.now() - last > limit) lockNow();
    };
    const iv = window.setInterval(check, 15_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, bump));
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", check);
    };
  }, [passcodeOn, phase, settings.autoLockMinutes, lockNow]);

  const value = useMemo<Ctx>(
    () => ({
      phase,
      error,
      trades,
      rows: toRows(trades),
      lists,
      settings,
      passcodeOn,
      persisted,
      lastBackup,
      autoBackup,
      async saveTrade(t, newImages = [], removed = []) {
        for (const im of newImages) await S.saveImage(im.id, t.id, im.blob);
        const next = { ...t, updatedAt: new Date().toISOString() };
        await S.saveTrade(next);
        if (removed.length) await S.deleteImages(removed);
        setTrades((cur) => (cur.some((x) => x.id === t.id) ? cur.map((x) => (x.id === t.id ? next : x)) : [...cur, next]));
        await rememberChoices(next);
        changed();
      },
      async deleteTrade(t) {
        await S.deleteTrade(t);
        setTrades((cur) => cur.filter((x) => x.id !== t.id));
        changed();
      },
      async addTrades(ts) {
        await S.saveTrades(ts);
        setTrades((cur) => [...cur, ...ts]);
        for (const t of ts) await rememberChoices(t);
        changed();
      },
      async saveLists(l) {
        await S.saveLists(l);
        setLists(l);
        changed();
      },
      async saveSettings(s) {
        await S.saveSettings(s);
        setSettings(s);
        changed();
      },
      reload: async () => {
        clearImageCache();
        await load();
        changed();
      },
      async finishWelcome() {
        await S.setMeta("welcomed", true);
        setPhase("ready");
      },
      lockNow,
      unlocked: load,
      refreshBackupInfo,
      backupNow,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, error, trades, lists, settings, passcodeOn, persisted, lastBackup, autoBackup, load, changed, lockNow, refreshBackupInfo, backupNow]
  );

  // Adds a trade's strategy/account to the remembered dropdown lists.
  async function rememberChoices(t: Trade) {
    setLists((cur) => {
      const strategies = t.strategy && !cur.strategies.includes(t.strategy) ? [...cur.strategies, t.strategy].sort() : cur.strategies;
      const accounts = t.account && !cur.accounts.includes(t.account) ? [...cur.accounts, t.account].sort() : cur.accounts;
      // Remember the member's own mistake names (presets are always offered anyway).
      const custom = (t.mistakes ?? []).filter((m) => !PRESET_MISTAKES.includes(m) && !cur.mistakes.includes(m));
      const mistakes = custom.length ? [...cur.mistakes, ...custom] : cur.mistakes;
      if (strategies === cur.strategies && accounts === cur.accounts && mistakes === cur.mistakes) return cur;
      const next = { strategies, accounts, mistakes };
      S.saveLists(next);
      return next;
    });
  }

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

// ---------- Screenshot URLs (decrypted on demand, cached while unlocked) ----------

const imageCache = new Map<string, Promise<string | null>>();

export function clearImageCache() {
  for (const p of imageCache.values()) p.then((u) => u && URL.revokeObjectURL(u));
  imageCache.clear();
}

export function imageUrl(id: string): Promise<string | null> {
  if (!imageCache.has(id)) {
    imageCache.set(
      id,
      S.getImage(id).then((b) => (b ? URL.createObjectURL(b) : null)).catch(() => null)
    );
  }
  return imageCache.get(id)!;
}

export function useImageUrl(id: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (id) imageUrl(id).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [id]);
  return url;
}
