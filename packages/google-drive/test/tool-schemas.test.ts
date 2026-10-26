import { describe, expect, it } from "vitest";

import {
  fileListInputSchema,
  fileReadInputSchema,
} from "../src/tool-schemas.js";

describe("tool schemas", () => {
  it("accepts bounded file list input", () => {
    const parsed = fileListInputSchema.safeParse({
      pageSize: 25,
      orderBy: "modifiedTime desc",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid orderBy", () => {
    const parsed = fileListInputSchema.safeParse({
      orderBy: "drop table files;",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid fileId characters", () => {
    const parsed = fileReadInputSchema.safeParse({
      fileId: "../../../etc/passwd",
    });
    expect(parsed.success).toBe(false);
  });
});
