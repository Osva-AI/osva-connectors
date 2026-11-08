export function buildSalesforceAuthHeader(accessToken: string): string {
  return `Bearer ${accessToken}`;
}

export function redactSalesforceSecrets(
  message: string,
  accessToken?: string,
): string {
  let result = message;
  if (accessToken !== undefined && accessToken.length > 0) {
    result = result.split(accessToken).join("[REDACTED]");
  }
  result = result.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");
  return result;
}
