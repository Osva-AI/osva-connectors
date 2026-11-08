import { describe, expect, it } from "vitest";

import { mapPersonGetResponse } from "../src/normalize-pipedrive.js";

describe("Pipedrive PII normalization", () => {
  it("omits person contact fields without INCLUDE_PII", () => {
    const out = mapPersonGetResponse(
      {
        success: true,
        data: {
          id: 10,
          name: "Jane Person",
          email: [{ value: "jane@example.test" }],
          phone: [{ value: "+1-555-0100" }],
          org_id: 20,
        },
      },
      false,
    );
    expect(out.person).not.toHaveProperty("name");
    expect(out.person).not.toHaveProperty("emails");
    expect(out.person).not.toHaveProperty("phones");
    expect(out.person.orgId).toBe(20);
  });

  it("includes person contact fields when INCLUDE_PII is enabled", () => {
    const out = mapPersonGetResponse(
      {
        success: true,
        data: {
          id: 10,
          name: "Jane Person",
          email: [{ value: "jane@example.test" }],
        },
      },
      true,
    );
    expect(out.person.name).toBe("Jane Person");
    expect(out.person.emails).toBeTruthy();
  });
});
