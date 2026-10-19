import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  mapPostgresError,
  sanitizeErrorMessage,
} from "../src/map-postgres-error.js";

describe("mapPostgresError", () => {
  it("maps authentication failures to UNAUTHORIZED", () => {
    const mapped = mapPostgresError({
      code: "28P01",
      message: "password failed",
    });
    expect(mapped).toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("maps PostgreSQL statement timeouts (57014) to TIMEOUT", () => {
    const mapped = mapPostgresError({
      code: "57014",
      message: "canceling statement due to statement timeout",
    });
    expect(mapped.code).toBe("TIMEOUT");
    expect(mapped.message).not.toContain("canceling statement");
  });

  it("maps TLS verification failures without leaking connection details", () => {
    const mapped = mapPostgresError(
      Object.assign(
        new Error(
          "unable to verify the first certificate postgresql://u:p@host/db",
        ),
        { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" },
      ),
    );
    expect(mapped.code).toBe("PROVIDER_ERROR");
    expect(mapped.message).not.toContain("postgresql://");
  });

  it("maps connection refusal to retryable PROVIDER_ERROR", () => {
    const mapped = mapPostgresError(
      Object.assign(new Error("connect refused"), { code: "ECONNREFUSED" }),
    );
    expect(mapped).toMatchObject({
      code: "PROVIDER_ERROR",
      retryable: true,
    });
  });

  it("does not expose raw driver messages in generic failures", () => {
    const mapped = mapPostgresError(
      new Error("FATAL: password authentication failed for user postgres"),
    );
    expect(mapped).toBeInstanceOf(ConnectorSdkError);
    expect(mapped.message).not.toContain("FATAL");
    expect(mapped.message).not.toContain("password authentication");
  });

  it("sanitizes connection strings from diagnostic text", () => {
    const sanitized = sanitizeErrorMessage(
      "failed for postgresql://user:secret@host/db",
    );
    expect(sanitized).not.toContain("secret");
    expect(sanitized).toContain("[redacted]");
  });
});
