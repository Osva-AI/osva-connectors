export function buildZendeskBasicAuthHeader(
  email: string,
  apiToken: string,
): string {
  const encoded = Buffer.from(`${email}/token:${apiToken}`, "utf8").toString(
    "base64",
  );
  return `Basic ${encoded}`;
}

export function redactZendeskSecrets(
  message: string,
  email?: string,
  apiToken?: string,
): string {
  let result = message;
  if (email !== undefined && email.length > 0) {
    result = result.split(email).join("[REDACTED]");
  }
  if (apiToken !== undefined && apiToken.length > 0) {
    result = result.split(apiToken).join("[REDACTED]");
  }
  result = result.replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "Basic [REDACTED]");
  return result;
}
