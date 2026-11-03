import { describe, expect, it } from "vitest";
import { formatDate, formatMoney } from "./format";

describe("format", () => {
  it("formats money from API strings without float maths", () => {
    expect(formatMoney("3500.00")).toBe("Rs. 3,500");
    expect(formatMoney("1250000.50")).toBe("Rs. 1,250,000.50");
    expect(formatMoney(null)).toBe("—");
  });

  it("formats plain dates without timezone shifts", () => {
    expect(formatDate("2026-04-01")).toBe("01 Apr 2026");
    expect(formatDate(undefined)).toBe("—");
  });
});
