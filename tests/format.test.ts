import { describe, it, expect, afterEach } from "vitest";
import { money, signedMoney, price, qty, num, setNumbersHidden, numbersHidden } from "../src/lib/format";

describe("hide numbers", () => {
  afterEach(() => setNumbersHidden(false));

  it("shows real numbers normally", () => {
    expect(numbersHidden()).toBe(false);
    expect(money(1234.5)).toBe("$1,234.50");
    expect(signedMoney(-20)).toBe("-$20.00");
    expect(price(6812.25)).toBe("6,812.25");
    expect(qty(3)).toBe("3");
    expect(num("55.0%")).toBe("55.0%");
  });

  it("hides every amount but keeps the win/loss sign", () => {
    setNumbersHidden(true);
    expect(money(1234.5)).toBe("$•••");
    expect(signedMoney(250)).toBe("+$•••");
    expect(signedMoney(-20)).toBe("-$•••");
    expect(price(6812.25)).toBe("•••");
    expect(price(null)).toBe("—");
    expect(qty(3)).toBe("•••");
    expect(num("2.5R")).toBe("•••");
  });
});
