import { describe, expect, it } from "vitest";

import { calcAge } from "./valueFormatting";

describe("calcAge", () => {
  it("calculates age relative to the provided in-game date", () => {
    expect(calcAge("2000-07-02", "2026-07-01T00:00:00Z")).toBe(25);
    expect(calcAge("2000-07-01", "2026-07-01T00:00:00Z")).toBe(26);
  });

  it("uses the as-of year instead of the real current year", () => {
    expect(calcAge("2000-01-01", "2025-01-01T00:00:00Z")).toBe(25);
    expect(calcAge("2000-01-01", "2027-01-01T00:00:00Z")).toBe(27);
  });
});
