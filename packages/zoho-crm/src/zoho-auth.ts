export function buildZohoAuthHeader(accessToken: string): string {
  return `Zoho-oauthtoken ${accessToken}`;
}

export function redactZohoSecrets(
  message: string,
  accessToken?: string,
): string {
  let result = message;
  if (accessToken !== undefined && accessToken.length > 0) {
    result = result.split(accessToken).join("[REDACTED]");
  }
  result = result.replace(
    /Zoho-oauthtoken\s+\S+/gi,
    "Zoho-oauthtoken [REDACTED]",
  );
  return result;
}
