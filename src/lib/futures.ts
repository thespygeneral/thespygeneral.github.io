// Common futures contracts with exchange specs. Point value = dollars per 1.00 point per contract.
// Members can always pick "Other" and type their own point value / tick size.

export type FuturesSpec = { root: string; name: string; pointValue: number; tickSize: number; group: string };

export const FUTURES: FuturesSpec[] = [
  // Equity index
  { root: "ES", name: "E-mini S&P 500", pointValue: 50, tickSize: 0.25, group: "Stock indexes" },
  { root: "MES", name: "Micro E-mini S&P 500", pointValue: 5, tickSize: 0.25, group: "Stock indexes" },
  { root: "NQ", name: "E-mini Nasdaq-100", pointValue: 20, tickSize: 0.25, group: "Stock indexes" },
  { root: "MNQ", name: "Micro E-mini Nasdaq-100", pointValue: 2, tickSize: 0.25, group: "Stock indexes" },
  { root: "YM", name: "E-mini Dow", pointValue: 5, tickSize: 1, group: "Stock indexes" },
  { root: "MYM", name: "Micro E-mini Dow", pointValue: 0.5, tickSize: 1, group: "Stock indexes" },
  { root: "RTY", name: "E-mini Russell 2000", pointValue: 50, tickSize: 0.1, group: "Stock indexes" },
  { root: "M2K", name: "Micro E-mini Russell 2000", pointValue: 5, tickSize: 0.1, group: "Stock indexes" },
  // Energy
  { root: "CL", name: "Crude Oil", pointValue: 1000, tickSize: 0.01, group: "Energy" },
  { root: "MCL", name: "Micro Crude Oil", pointValue: 100, tickSize: 0.01, group: "Energy" },
  { root: "NG", name: "Natural Gas", pointValue: 10000, tickSize: 0.001, group: "Energy" },
  // Metals
  { root: "GC", name: "Gold", pointValue: 100, tickSize: 0.1, group: "Metals" },
  { root: "MGC", name: "Micro Gold", pointValue: 10, tickSize: 0.1, group: "Metals" },
  { root: "SI", name: "Silver", pointValue: 5000, tickSize: 0.005, group: "Metals" },
  { root: "SIL", name: "Micro Silver", pointValue: 1000, tickSize: 0.005, group: "Metals" },
  { root: "HG", name: "Copper", pointValue: 25000, tickSize: 0.0005, group: "Metals" },
  // Rates
  { root: "ZB", name: "30-Year T-Bond", pointValue: 1000, tickSize: 0.03125, group: "Rates" },
  { root: "ZN", name: "10-Year T-Note", pointValue: 1000, tickSize: 0.015625, group: "Rates" },
  { root: "ZF", name: "5-Year T-Note", pointValue: 1000, tickSize: 0.0078125, group: "Rates" },
  // Currencies
  { root: "6E", name: "Euro FX", pointValue: 125000, tickSize: 0.00005, group: "Currencies" },
  { root: "M6E", name: "Micro Euro FX", pointValue: 12500, tickSize: 0.0001, group: "Currencies" },
  { root: "6J", name: "Japanese Yen", pointValue: 12500000, tickSize: 0.0000005, group: "Currencies" },
  // Crypto
  { root: "BTC", name: "Bitcoin", pointValue: 5, tickSize: 5, group: "Crypto" },
  { root: "MBT", name: "Micro Bitcoin", pointValue: 0.1, tickSize: 5, group: "Crypto" },
  { root: "ETH", name: "Ether", pointValue: 50, tickSize: 0.5, group: "Crypto" },
  { root: "MET", name: "Micro Ether", pointValue: 0.1, tickSize: 0.5, group: "Crypto" },
  // Grains
  { root: "ZC", name: "Corn", pointValue: 50, tickSize: 0.25, group: "Grains" },
  { root: "ZS", name: "Soybeans", pointValue: 50, tickSize: 0.25, group: "Grains" },
  { root: "ZW", name: "Wheat", pointValue: 50, tickSize: 0.25, group: "Grains" },
];

export function findFuture(root: string): FuturesSpec | undefined {
  return FUTURES.find((f) => f.root === root.toUpperCase().trim());
}
