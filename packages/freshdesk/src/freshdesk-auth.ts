export function buildFreshdeskBasicAuthHeader(apiKey: string): string {
  const encoded = Buffer.from(`${apiKey}:X`, "utf8").toString("base64");
  return `Basic ${encoded}`;
}

export function redactFreshdeskSecrets(
  message: string,
  apiKey?: string,
): string {
  let result = message;
  if (apiKey !== undefined && apiKey.length > 0) {
    result = result.split(apiKey).join("[REDACTED]");
  }
  result = result.replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "Basic [REDACTED]");
  return result;
}
