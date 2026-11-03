import { describe, expect, it } from "vitest";
import { allocateOldestFirst, fromPaisa, isAmount, sumPaisa, toPaisa } from "./money";

describe("money", () => {
  it("parses amounts exactly", () => {
    expect(toPaisa("3500")).toBe(350000n);
    expect(toPaisa("3,500.5")).toBe(350050n);
    expect(toPaisa("0.10")).toBe(10n);
    expect(toPaisa("-500.25")).toBe(-50025n);
    expect(() => toPaisa("12.345")).toThrow();
  });

  it("formats paisa back to the API format", () => {
    expect(fromPaisa(350025n)).toBe("3500.25");
    expect(fromPaisa(5n)).toBe("0.05");
    expect(fromPaisa(-100n)).toBe("-1.00");
  });

  it("adds without floating-point drift", () => {
    expect(fromPaisa(sumPaisa(["0.10", "0.20", "0.30"]))).toBe("0.60");
  });

  it("validates user input", () => {
    expect(isAmount("5000")).toBe(true);
    expect(isAmount("0")).toBe(false);
    expect(isAmount("0", { allowZero: true })).toBe(true);
    expect(isAmount("abc")).toBe(false);
  });

  it("allocates oldest first and leaves the rest", () => {
    expect(allocateOldestFirst(500000n, [350000n, 350000n])).toEqual([350000n, 150000n]);
    expect(allocateOldestFirst(100n, [350000n, 350000n])).toEqual([100n, 0n]);
  });
});
