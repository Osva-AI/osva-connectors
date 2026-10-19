import { describe, expect, it } from "vitest";

import { parsePostgresConnectionUrl } from "../src/parse-connection-url.js";

describe("parsePostgresConnectionUrl", () => {
  it("strips URL ssl parameters so pool ssl config is authoritative", () => {
    const parsed = parsePostgresConnectionUrl(
      "postgresql://user:secret@db.example.com:5432/app?sslmode=require&ssl=true",
    );
    expect(parsed.host).toBe("db.example.com");
    expect(parsed.connectionString).not.toContain("sslmode=");
    expect(parsed.connectionString).not.toContain("ssl=true");
  });
});
