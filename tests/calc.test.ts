import { describe, it, expect } from "vitest";
import { summarize, computeStats, rows, dailyPnl, contractLabel } from "../src/lib/calc";
import { blankTrade } from "../src/lib/ids";
import type { Trade } from "../src/lib/types";

const f = (date: string, price: number, quantity: number) => ({ id: Math.random().toString(), date, price, quantity });

function stock(over: Partial<Trade> = {}): Trade {
  return { ...blankTrade("EQUITY"), symbol: "AAPL", ...over };
}

describe("equities", () => {
  it("long P&L with scaling in, fees, return %, R", () => {
    const t = stock({
      entries: [f("2026-11-03T09:45", 100, 10), f("2026-11-03T10:00", 110, 10)],
      exits: [f("2026-11-03T11:00", 120, 20)],
      fees: 2,
      stopLoss: 100,
    });
    const s = summarize(t);
    expect(s.avgEntry).toBe(105);
    expect(s.status).toBe("CLOSED");
    expect(s.pnl).toBe(298); // (120-105)*20 - 2
    expect(s.returnPct).toBe(14.2); // 298 / 2100
    expect(s.rMultiple).toBe(2.98); // risk (105-100)*20 = 100
    expect(s.holdMinutes).toBe(75);
  });
  it("short stock profits when price falls", () => {
    const s = summarize(stock({ side: "SHORT", entries: [f("2026-11-03", 50, 100)], exits: [f("2026-11-04", 45, 100)] }));
    expect(s.pnl).toBe(500);
  });
  it("partially closed stays open, realized P&L on closed part", () => {
    const s = summarize(stock({ entries: [f("2026-11-03", 10, 100)], exits: [f("2026-11-04", 12, 40)] }));
    expect(s.status).toBe("OPEN");
    expect(s.openQty).toBe(60);
    expect(s.pnl).toBe(80);
  });
  it("no exits = open, no P&L", () => {
    const s = summarize(stock({ entries: [f("2026-11-03", 10, 100)] }));
    expect(s.status).toBe("OPEN");
    expect(s.pnl).toBeNull();
  });
});

describe("options", () => {
  it("uses the 100x multiplier", () => {
    const t: Trade = {
      ...blankTrade("OPTION"),
      symbol: "SPY",
      option: { structure: "SINGLE", type: "CALL", strike: 680, expiration: "2026-11-20", multiplier: 100, spreadName: "" },
      entries: [f("2026-11-04T10:02", 2.15, 3)],
      exits: [f("2026-11-04T10:40", 3.05, 3)],
      fees: 1.95,
    };
    const s = summarize(t);
    expect(s.pnl).toBe(268.05); // 0.90*3*100 - 1.95
    expect(s.daysToExpiration).toBe(16);
    expect(contractLabel(t)).toBe("SPY 680C 11/20/26");
  });
  it("sold option that expires worthless keeps the premium", () => {
    const t: Trade = {
      ...blankTrade("OPTION", "SHORT"),
      symbol: "SPX",
      option: { structure: "SINGLE", type: "PUT", strike: 6500, expiration: "2026-11-06", multiplier: 100, spreadName: "" },
      entries: [f("2026-11-05", 4.2, 2)],
      exits: [f("2026-11-06", 0, 2)],
    };
    expect(summarize(t).pnl).toBe(840);
    expect(summarize(t).returnPct).toBeNull(); // no clear "money put in" for sold options
  });
  it("credit spread at net price", () => {
    const t: Trade = {
      ...blankTrade("OPTION", "SHORT"),
      symbol: "SPX",
      option: { structure: "SPREAD", type: null, strike: null, expiration: "2026-11-06", multiplier: 100, spreadName: "Iron Condor" },
      entries: [f("2026-11-05", 1.5, 1)],
      exits: [f("2026-11-06", 0.4, 1)],
    };
    expect(summarize(t).pnl).toBe(110);
    expect(contractLabel(t)).toBe("SPX Iron Condor 11/6/26");
  });
});

describe("futures", () => {
  it("points × point value × contracts, ticks", () => {
    const t: Trade = {
      ...blankTrade("FUTURE", "SHORT"),
      symbol: "MES",
      future: { contract: "MES", contractMonth: "2026-12", pointValue: 5, tickSize: 0.25 },
      entries: [f("2026-11-05T09:35", 6812.25, 2)],
      exits: [f("2026-11-05T09:58", 6798.5, 2)],
      fees: 2.5,
    };
    const s = summarize(t);
    expect(s.pointsPerUnit).toBeCloseTo(13.75);
    expect(s.ticks).toBe(55);
    expect(s.pnl).toBe(135); // 13.75*5*2 - 2.5
    expect(s.returnPct).toBeNull();
    expect(contractLabel(t)).toBe("MES Dec 2026");
  });
  it("ES long losing trade", () => {
    const t: Trade = {
      ...blankTrade("FUTURE"),
      symbol: "ES",
      future: { contract: "ES", contractMonth: "", pointValue: 50, tickSize: 0.25 },
      entries: [f("2026-11-05", 6800, 1)],
      exits: [f("2026-11-05", 6795.5, 1)],
    };
    expect(summarize(t).pnl).toBe(-225);
  });
});

describe("stats", () => {
  it("win rate, profit factor, streak, daily buckets", () => {
    const mk = (day: string, entry: number, exit: number) =>
      stock({ entries: [f(`${day}T09:30`, entry, 1)], exits: [f(`${day}T10:00`, exit, 1)] });
    const list = rows([mk("2026-11-02", 10, 20), mk("2026-11-03", 10, 5), mk("2026-11-03", 10, 30), mk("2026-11-04", 10, 25)]);
    const st = computeStats(list);
    expect(st.closed).toBe(4);
    expect(st.winRate).toBe(75);
    expect(st.totalPnl).toBe(40);
    expect(st.profitFactor).toBe(9); // 45 / 5
    expect(st.streak).toEqual({ type: "win", count: 2 });
    expect(dailyPnl(list).get("2026-11-03")).toEqual({ pnl: 15, trades: 2, wins: 1, losses: 1 });
  });
});
