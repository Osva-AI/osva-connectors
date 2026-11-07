import { describe, expect, it } from "vitest";

import { fileUploadSmallInputSchema } from "../src/tool-schemas.js";

describe("OneDrive: host approval is not a tool input field", () => {
  it("upload schema does not expose write gates", () => {
    expect(fileUploadSmallInputSchema.shape).not.toHaveProperty("writeEnabled");
    expect(fileUploadSmallInputSchema.shape).not.toHaveProperty(
      "hostWritesApproved",
    );
  });
});
