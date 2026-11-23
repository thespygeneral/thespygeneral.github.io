import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import * as S from "../src/lib/storage";
import { makeBackup, restoreBackup, readBackupFile } from "../src/lib/backup";
import { blankTrade } from "../src/lib/ids";
import { normalizeRecoveryCode } from "../src/lib/crypto";

async function fresh() {
  await S._resetForTests();
  await new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase("trade-journal");
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });
}

function trade(symbol: string) {
  const t = blankTrade("EQUITY");
  t.symbol = symbol;
  t.notes = "secret thesis";
  t.entries = [{ id: "e", date: "2026-11-03", price: 10, quantity: 5 }];
  return t;
}

async function rawTradeRecords() {
  return new Promise<unknown[]>((res) => {
    const open = indexedDB.open("trade-journal");
    open.onsuccess = () => {
      const req = open.result.transaction("trades").objectStore("trades").getAll();
      req.onsuccess = () => {
        open.result.close();
        res(req.result);
      };
    };
  });
}

describe("storage + passcode", { timeout: 60_000 }, () => {
  beforeEach(fresh);

  it("saves and loads without a passcode", async () => {
    await S.saveTrade(trade("AAPL"));
    const j = await S.loadJournal();
    expect(j.trades.map((t) => t.symbol)).toEqual(["AAPL"]);
  });

  it("passcode encrypts everything at rest; wrong passcode fails; right one and recovery work", async () => {
    const t = trade("TSLA");
    await S.saveTrade(t);
    await S.saveImage("img1", t.id, new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }));
    const code = await S.setPasscode("hunter22");
    expect(code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/);

    const raw = JSON.stringify(await rawTradeRecords());
    expect(raw).not.toContain("TSLA");
    expect(raw).not.toContain("secret thesis");

    S.lock();
    await expect(S.loadJournal()).rejects.toThrow("LOCKED");
    expect(await S.unlock("wrong")).toBe(false);
    expect(await S.unlock("hunter22")).toBe(true);
    expect((await S.loadJournal()).trades[0].symbol).toBe("TSLA");
    const img = await S.getImage("img1");
    expect([...new Uint8Array(await img!.arrayBuffer())]).toEqual([1, 2, 3]);

    S.lock();
    expect(await S.unlockWithRecovery(code.toLowerCase().replace(/-/g, " "))).toBe(true);
    await S.changePasscode("newpass1");
    S.lock();
    expect(await S.unlock("hunter22")).toBe(false);
    expect(await S.unlock("newpass1")).toBe(true);

    await S.removePasscode();
    S.lock();
    expect(await S.hasPasscode()).toBe(false);
    expect((await S.loadJournal()).trades[0].notes).toBe("secret thesis");
  });

  it("protected backup restores only with the passcode", async () => {
    await S.saveTrade(trade("NVDA"));
    await S.setPasscode("pass1234");
    const blob = await makeBackup();
    const text = await blob.text();
    expect(text).not.toContain("NVDA");

    await fresh();
    const read = await readBackupFile(new File([text], "b.json"));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.file.protected).toBe(true);
    expect(await restoreBackup(read.file, "nope")).toBe(false);
    expect(await restoreBackup(read.file, "pass1234")).toBe(true);
    expect(await S.hasPasscode()).toBe(true);
    expect((await S.loadJournal()).trades[0].symbol).toBe("NVDA");
    S.lock();
    expect(await S.unlock("pass1234")).toBe(true);
  });

  it("plain backup round-trips trades and screenshots", async () => {
    const t = trade("AMD");
    t.screenshotIds = ["s1"];
    await S.saveTrade(t);
    await S.saveImage("s1", t.id, new Blob([new Uint8Array([9, 8, 7])], { type: "image/jpeg" }));
    const text = await (await makeBackup()).text();
    await fresh();
    const read = await readBackupFile(new File([text], "b.json"));
    if (!read.ok) throw new Error("bad");
    expect(await restoreBackup(read.file)).toBe(true);
    expect((await S.loadJournal()).trades[0].symbol).toBe("AMD");
    const img = await S.getImage("s1");
    expect(img!.type).toBe("image/jpeg");
    expect([...new Uint8Array(await img!.arrayBuffer())]).toEqual([9, 8, 7]);
  });

  it("rejects files that are not backups", async () => {
    expect((await readBackupFile(new File(["hello"], "x.json"))).ok).toBe(false);
    expect((await readBackupFile(new File(['{"a":1}'], "x.json"))).ok).toBe(false);
  });

  it("recovery code normalizes typing mistakes", () => {
    expect(normalizeRecoveryCode("abcde fghjk-mnpqr stuvw")).toBe("ABCDE-FGHJK-MNPQR-STUVW");
  });
});
