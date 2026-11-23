import { describe, it, expect } from "vitest";
import { rows, mistakeStats, pnlByTimeOfDay, dayLimitStatus, timeRangeLabel, computeStats } from "../src/lib/calc";
import { blankTrade } from "../src/lib/ids";
import { normalizeTrade, normalizeLists, type Trade } from "../src/lib/types";

const f = (date: string, price: number, quantity: number) => ({ id: Math.random().toString(), date, price, quantity });
function trade(open: string, entry: number, exit: number, mistakes: string[] = []): Trade {
  return { ...blankTrade("EQUITY"), symbol: "AAPL", entries: [f(open, entry, 1)], exits: [f(open.slice(0, 10) + "T15:00", exit, 1)], mistakes };
}

describe("mistakes cost", () => {
  it("splits clean vs mistake trades and ranks the costliest mistake first", () => {
    const r = rows([
      trade("2026-11-02T09:35", 100, 110), // clean +10
      trade("2026-11-02T10:05", 100, 80, ["FOMO"]), // -20
      trade("2026-11-03T09:40", 100, 95, ["FOMO", "No stop"]), // -5
      trade("2026-11-03T14:10", 100, 104, ["Cut a winner early"]), // +4
    ]);
    const m = mistakeStats(r);
    expect(m.clean).toEqual({ trades: 1, pnl: 10 });
    expect(m.withMistakes).toEqual({ trades: 3, pnl: -21, lost: -25 });
    expect(m.byMistake[0]).toEqual({ key: "FOMO", trades: 2, pnl: -25, lost: -25 });
    expect(m.byMistake.map((x) => x.key)).toEqual(["FOMO", "No stop", "Cut a winner early"]);
  });

  it("works with trades saved before mistakes existed", () => {
    const old = { ...trade("2026-11-02T09:35", 100, 90) } as Partial<Trade>;
    delete old.mistakes;
    const t = normalizeTrade(old as Trade);
    expect(t.mistakes).toEqual([]);
    expect(mistakeStats(rows([t])).clean.trades).toBe(1);
    expect(computeStats(rows([t])).totalPnl).toBe(-10);
    expect(normalizeLists({ strategies: ["ORB"], accounts: [] } as never)).toEqual({ strategies: ["ORB"], accounts: [], mistakes: [] });
  });
});

describe("time of day", () => {
  it("groups by 30 minutes of the entry time and skips trades without a time", () => {
    const r = rows([
      trade("2026-11-02T09:35", 100, 110),
      trade("2026-11-03T09:59", 100, 95),
      trade("2026-11-03T14:10", 100, 104),
      { ...trade("2026-11-03T14:10", 100, 104), entries: [f("2026-11-04", 100, 1)] },
    ]);
    const b = pnlByTimeOfDay(r);
    expect(b.map((x) => [x.key, x.pnl, x.trades])).toEqual([
      ["9:30a", 5, 2],
      ["2:00p", 4, 1],
    ]);
    expect(timeRangeLabel(9 * 60 + 30)).toBe("9:30–10:00 AM");
    expect(timeRangeLabel(11 * 60 + 30)).toBe("11:30–12:00 PM");
  });
});

describe("daily limits", () => {
  it("is off until the member sets something", () => {
    expect(dayLimitStatus(-999, null, null).state).toBe("none");
  });
  it("tracks loss limit and goal", () => {
    expect(dayLimitStatus(-100, 400, 500)).toMatchObject({ state: "ok", lossUsed: 0.25, goalProgress: 0 });
    expect(dayLimitStatus(-300, 400, null).state).toBe("near-limit");
    expect(dayLimitStatus(-400, 400, null).state).toBe("limit-hit");
    expect(dayLimitStatus(520, 400, 500)).toMatchObject({ state: "goal-hit", goalProgress: 1, lossUsed: 0 });
  });
});
