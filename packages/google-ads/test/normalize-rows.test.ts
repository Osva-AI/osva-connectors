import { describe, expect, it } from "vitest";

import { microsToCurrencyAmount } from "../src/normalize-rows.js";

describe("reporting normalization", () => {
  it("preserves micros and converts cost when currency is known", () => {
    expect(microsToCurrencyAmount(2_500_000, "USD")).toEqual({
      costMicros: 2_500_000,
      cost: 2.5,
      currencyCode: "USD",
    });
  });

  it("does not fabricate converted cost without currency", () => {
    expect(microsToCurrencyAmount(2_500_000, null)).toEqual({
      costMicros: 2_500_000,
      cost: null,
      currencyCode: null,
    });
  });
});
