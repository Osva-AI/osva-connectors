export function redactBigcommerceSecrets(
  message: string,
  accessToken?: string,
): string {
  let result = message;
  if (accessToken !== undefined && accessToken.length > 0) {
    result = result.split(accessToken).join("[REDACTED]");
  }
  result = result.replace(/X-Auth-Token:\s*\S+/gi, "X-Auth-Token: [REDACTED]");
  return result;
}
