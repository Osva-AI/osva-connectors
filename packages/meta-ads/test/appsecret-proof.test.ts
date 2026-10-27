import { describe, expect, it } from "vitest";

import { computeAppSecretProof } from "../src/appsecret-proof.js";

describe("computeAppSecretProof", () => {
  it("returns stable HMAC hex", () => {
    const proof = computeAppSecretProof("token-value", "app-secret");
    expect(proof).toMatch(/^[a-f0-9]{64}$/);
    expect(computeAppSecretProof("token-value", "app-secret")).toBe(proof);
  });
});
