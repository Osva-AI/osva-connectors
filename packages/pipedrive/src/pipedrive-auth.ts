export function redactPipedriveSecrets(
  message: string,
  apiToken?: string,
): string {
  let result = message;
  if (apiToken !== undefined && apiToken.length > 0) {
    result = result.split(apiToken).join("[REDACTED]");
  }
  result = result.replace(/x-api-token:\s*\S+/gi, "x-api-token: [REDACTED]");
  return result;
}
