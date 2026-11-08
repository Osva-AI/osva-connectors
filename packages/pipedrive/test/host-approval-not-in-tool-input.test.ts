import { describe, expect, it } from "vitest";

import { dealStageSetInputSchema } from "../src/tool-schemas.js";

describe("Pipedrive: host approval is not a tool input field", () => {
  it("mutation schema does not expose write gates", () => {
    expect(dealStageSetInputSchema.shape).not.toHaveProperty("stageEnabled");
    expect(dealStageSetInputSchema.shape).not.toHaveProperty(
      "hostWritesApproved",
    );
  });
});
