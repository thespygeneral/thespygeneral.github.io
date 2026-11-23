import { describe, it, expect } from "vitest";
import { niceScale } from "../src/components/Charts";

describe("chart scale", () => {
  it("always includes $0 with round steps", () => {
    expect(niceScale([298.5, 100, -700])).toEqual({ lo: -750, hi: 500, ticks: [-750, -500, -250, 0, 250, 500] });
    expect(niceScale([-201.5])).toEqual({ lo: -300, hi: 0, ticks: [-300, -200, -100, 0] });
    expect(niceScale([45, 120])).toEqual({ lo: 0, hi: 150, ticks: [0, 50, 100, 150] });
    expect(niceScale([0])).toEqual({ lo: 0, hi: 1, ticks: [0, 1] });
  });
});
