import { describe, expect, it } from "vitest";
import {
  decodeContinuationToken,
  encodeContinuationToken,
  fingerprintFilters,
  parseValidatedQueryLocator,
} from "../src/query-continuation.js";
import { ConnectorSdkError } from "@osva-ai/connector-sdk";

const PINNED = "http://127.0.0.1:9";
const API_BASE = `${PINNED}/services/data/v59.0`;

describe("Salesforce query continuation", () => {
  it("round-trips opaque continuation tokens", () => {
    const token = encodeContinuationToken({
      v: 1,
      family: "account",
      filterFingerprint: fingerprintFilters({}),
      locatorSuffix: "/query/01gTEST-200",
    });
    const decoded = decodeContinuationToken(token);
    expect(decoded.family).toBe("account");
    expect(decoded.locatorSuffix).toBe("/query/01gTEST-200");
  });

  it("rejects cross-query family misuse", () => {
    const token = encodeContinuationToken({
      v: 1,
      family: "contact",
      filterFingerprint: "{}",
      locatorSuffix: "/query/01gTEST-200",
    });
    const decoded = decodeContinuationToken(token);
    expect(decoded.family).not.toBe("account");
  });

  it("rejects cross-origin locator URLs", () => {
    expect(() =>
      parseValidatedQueryLocator(
        "http://evil.test/services/data/v59.0/query/01gX-200",
        PINNED,
        API_BASE,
        "/services/data/v59.0",
      ),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects wrong API version path", () => {
    expect(() =>
      parseValidatedQueryLocator(
        `${PINNED}/services/data/v60.0/query/01gX-200`,
        PINNED,
        API_BASE,
        "/services/data/v59.0",
      ),
    ).toThrow(ConnectorSdkError);
  });

  it("accepts valid locator on pinned origin", () => {
    const suffix = parseValidatedQueryLocator(
      `${PINNED}/services/data/v59.0/query/01gVALID-200`,
      PINNED,
      API_BASE,
      "/services/data/v59.0",
    );
    expect(suffix).toBe("/query/01gVALID-200");
  });

  it("rejects malformed tokens", () => {
    expect(() => decodeContinuationToken("not-base64url!!!")).toThrow(
      ConnectorSdkError,
    );
  });
});
