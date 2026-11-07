import { describe, expect, it } from "vitest";

import {
  AMPLITUDE_PROVIDER_CALCULATED_LABELS,
  mapEventListResponse,
  mapSeriesAnalyticsResponse,
} from "../src/normalize-amplitude.js";

describe("normalize-amplitude", () => {
  it("labels event catalog as provider-calculated", () => {
    const result = mapEventListResponse({
      data: { events: ["Purchase"] },
    }) as { providerCalculated: string; events: string[] };
    expect(result.providerCalculated).toBe(
      AMPLITUDE_PROVIDER_CALCULATED_LABELS.eventCatalog,
    );
    expect(result.events).toEqual(["Purchase"]);
  });

  it("truncates oversized xValues locally", () => {
    const longLabels = Array.from(
      { length: 4_000 },
      (_, index) => `label-${index}-${"x".repeat(60)}`,
    );
    const result = mapSeriesAnalyticsResponse({
      raw: {
        data: {
          series: [[1]],
          xValues: longLabels,
        },
      },
      start: "20240601",
      end: "20240607",
      providerCalculated: AMPLITUDE_PROVIDER_CALCULATED_LABELS.timeSeries,
    });
    expect(result.xValues?.length).toBeLessThan(longLabels.length);
    expect(result.providerCalculated).toBe(
      AMPLITUDE_PROVIDER_CALCULATED_LABELS.timeSeries,
    );
  });
});
