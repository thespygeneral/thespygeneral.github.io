// The shape of everything a member saves. Kept deliberately plain (strings + numbers) so it
// round-trips through backups, encryption and Excel without surprises.

export type AssetClass = "EQUITY" | "OPTION" | "FUTURE";
export type Side = "LONG" | "SHORT";

/** One buy or sell. `date` is local time "YYYY-MM-DDTHH:mm", or "YYYY-MM-DD" when the time is unknown. */
export type Fill = { id: string; date: string; price: number; quantity: number };

export type OptionDetails = {
  /** SINGLE = one call or put. SPREAD = several legs logged at their combined (net) price. */
  structure: "SINGLE" | "SPREAD";
  type: "CALL" | "PUT" | null; // null for spreads
  strike: number | null; // null for spreads
  expiration: string; // YYYY-MM-DD
  multiplier: number; // shares per contract, normally 100
  spreadName: string; // e.g. "Iron Condor 5900/5910/6100/6110" — spreads only
};

export type FutureDetails = {
  contract: string; // root, e.g. ES, MNQ, CL
  contractMonth: string; // YYYY-MM, optional ("" when not given)
  pointValue: number; // $ per 1.00 point move per contract
  tickSize: number; // smallest price increment, in points
};

export type Trade = {
  id: string;
  assetClass: AssetClass;
  side: Side;
  /** Ticker (equities), underlying (options), or contract root (futures). Always upper-case. */
  symbol: string;
  option: OptionDetails | null;
  future: FutureDetails | null;
  entries: Fill[];
  exits: Fill[];
  fees: number; // total commissions + fees for the whole trade
  stopLoss: number | null; // planned stop, used for R-multiple
  target: number | null; // planned target
  account: string;
  strategy: string;
  tags: string[];
  grade: "" | "A" | "B" | "C" | "D" | "F";
  notes: string;
  screenshotIds: string[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export type Screenshot = { id: string; tradeId: string; blob: Blob; type: string; createdAt: string };

/** Lists the member manages (kept so dropdowns remember their choices). */
export type Lists = { strategies: string[]; accounts: string[] };

export type Settings = {
  autoLockMinutes: number; // 0 = never (only applies when a passcode is set)
  backupReminderDays: number;
};

export const DEFAULT_SETTINGS: Settings = { autoLockMinutes: 15, backupReminderDays: 7 };
