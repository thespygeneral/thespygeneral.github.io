import type { Trade, AssetClass, Side } from "./types";

export const newId = () => crypto.randomUUID();

/** A blank trade of the given type with sensible defaults. */
export function blankTrade(assetClass: AssetClass, side: Side = "LONG"): Trade {
  const now = new Date().toISOString();
  return {
    id: newId(),
    assetClass,
    side,
    symbol: "",
    option:
      assetClass === "OPTION"
        ? { structure: "SINGLE", type: "CALL", strike: null, expiration: "", multiplier: 100, spreadName: "" }
        : null,
    future: assetClass === "FUTURE" ? { contract: "", contractMonth: "", pointValue: 0, tickSize: 0 } : null,
    entries: [],
    exits: [],
    fees: 0,
    stopLoss: null,
    target: null,
    account: "",
    strategy: "",
    tags: [],
    grade: "",
    notes: "",
    screenshotIds: [],
    createdAt: now,
    updatedAt: now,
  };
}
