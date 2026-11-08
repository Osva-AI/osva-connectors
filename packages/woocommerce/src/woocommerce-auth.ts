export function buildWoocommerceBasicAuthHeader(
  consumerKey: string,
  consumerSecret: string,
): string {
  const encoded = Buffer.from(
    `${consumerKey}:${consumerSecret}`,
    "utf8",
  ).toString("base64");
  return `Basic ${encoded}`;
}

export function redactWoocommerceSecrets(
  message: string,
  consumerKey?: string,
  consumerSecret?: string,
): string {
  let result = message;
  if (consumerKey !== undefined && consumerKey.length > 0) {
    result = result.split(consumerKey).join("[REDACTED]");
  }
  if (consumerSecret !== undefined && consumerSecret.length > 0) {
    result = result.split(consumerSecret).join("[REDACTED]");
  }
  result = result.replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "Basic [REDACTED]");
  return result;
}
