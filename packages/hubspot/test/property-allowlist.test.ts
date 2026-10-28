import { describe, expect, it } from "vitest";

import {
  filterNormalizedProperties,
  parseAllowedObjectTypes,
  resolveApiProperties,
} from "../src/property-allowlist.js";

describe("property allowlist", () => {
  it("defaults allowed object types", () => {
    expect(parseAllowedObjectTypes(undefined)).toEqual([
      "contacts",
      "companies",
      "deals",
    ]);
  });

  it("omits PII properties when includePii is false", () => {
    const props = resolveApiProperties("contacts", false);
    expect(props).toContain("lifecyclestage");
    expect(props).not.toContain("email");
  });

  it("filters provider properties to allowlist", () => {
    const filtered = filterNormalizedProperties(
      "contacts",
      {
        lifecyclestage: "lead",
        email: "secret@example.com",
        unknown_custom: "x",
      },
      false,
    );
    expect(filtered).toEqual({ lifecyclestage: "lead" });
  });
});
