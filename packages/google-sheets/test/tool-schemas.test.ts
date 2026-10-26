import { describe, expect, it } from "vitest";

import {
  valuesAppendInputSchema,
  valuesGetInputSchema,
} from "../src/tool-schemas.js";
import { MOCK_SPREADSHEET_ID } from "./fixtures/mock-sheets-http-server.js";

describe("tool input schemas", () => {
  it("accepts bounded values.get input", () => {
    const parsed = valuesGetInputSchema.safeParse({
      spreadsheetId: MOCK_SPREADSHEET_ID,
      range: "Data!A1:B2",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty values matrix for append", () => {
    const parsed = valuesAppendInputSchema.safeParse({
      spreadsheetId: MOCK_SPREADSHEET_ID,
      range: "Data!A1",
      values: [],
    });
    expect(parsed.success).toBe(false);
  });
});
