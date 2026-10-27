import { createHmac } from "node:crypto";

export function computeAppSecretProof(
  accessToken: string,
  appSecret: string,
): string {
  return createHmac("sha256", appSecret.trim())
    .update(accessToken.trim())
    .digest("hex");
}
