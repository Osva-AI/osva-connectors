import { describe, expect, it } from "vitest";

import { mapInsightsRow } from "../src/normalize-insights.js";

describe("mapInsightsRow", () => {
  it("preserves spend decimal strings and action arrays", () => {
    const row = mapInsightsRow({
      spend: "12.34",
      impressions: "100",
      actions: [{ action_type: "link_click", value: "5" }],
      action_values: [{ action_type: "purchase", value: "9.99" }],
      account_currency: "USD",
    });
    expect(row.spend).toBe("12.34");
    expect(row.actions).toEqual([{ actionType: "link_click", value: "5" }]);
    expect(row.actionValues).toEqual([
      { actionType: "purchase", value: "9.99" },
    ]);
    expect(row.accountCurrency).toBe("USD");
  });
});
