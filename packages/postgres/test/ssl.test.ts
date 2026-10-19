import { describe, expect, it } from "vitest";

import {
  defaultSslModeForHost,
  parsePostgresSslMode,
  resolveNodePostgresSslOption,
} from "../src/ssl.js";

describe("PostgreSQL SSL resolution", () => {
  it("defaults local hosts to disable and remote hosts to verify", () => {
    expect(defaultSslModeForHost("localhost")).toBe("disable");
    expect(defaultSslModeForHost("db.example.com")).toBe("verify");
  });

  it("maps modes to node-postgres ssl options", () => {
    expect(resolveNodePostgresSslOption("disable")).toBe(false);
    expect(resolveNodePostgresSslOption("verify")).toEqual({
      rejectUnauthorized: true,
    });
    expect(resolveNodePostgresSslOption("require")).toEqual({
      rejectUnauthorized: false,
    });
  });

  it("rejects unsupported ssl mode strings", () => {
    expect(() => parsePostgresSslMode("prefer")).toThrow();
  });

  it("never maps verify mode to unauthenticated TLS", () => {
    const ssl = resolveNodePostgresSslOption("verify");
    expect(ssl).toEqual({ rejectUnauthorized: true });
  });

  it("requires explicit require mode for unverified TLS", () => {
    const ssl = resolveNodePostgresSslOption("require");
    expect(ssl).toEqual({ rejectUnauthorized: false });
  });
});
