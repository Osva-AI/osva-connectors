import { describe, expect, it } from "vitest";
import { mapRecordGetResponse } from "../src/normalize-salesforce.js";

describe("Salesforce PII normalization", () => {
  it("redacts contact email and phone", () => {
    const out = mapRecordGetResponse(
      {
        Id: "003000000000001AAA",
        Name: "Fixture Contact",
        Email: "user@example.test",
        Phone: "+15550123",
      },
      false,
      "contact",
    );
    const contact = out.contact as Record<string, unknown>;
    expect(contact.Email).toBe("[REDACTED]");
    expect(contact.Phone).toBe("[REDACTED]");
    expect(contact.Name).toBe("Fixture Contact");
  });

  it("keeps PII when enabled", () => {
    const out = mapRecordGetResponse(
      {
        Id: "003000000000001AAA",
        Email: "user@example.test",
      },
      true,
      "contact",
    );
    const contact = out.contact as Record<string, unknown>;
    expect(contact.Email).toBe("user@example.test");
  });
});
