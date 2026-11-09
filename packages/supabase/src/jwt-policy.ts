import { ConnectorSdkError } from "@osva-ai/connector-sdk";

function decodeJwtPayload(token: string): Record<string, unknown> | undefined {
  const parts = token.split(".");
  const payloadPart = parts[1];
  if (parts.length !== 3 || payloadPart === undefined) {
    return undefined;
  }
  try {
    const json = Buffer.from(payloadPart, "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function readJwtRole(token: string): string | undefined {
  const payload = decodeJwtPayload(token);
  const role = payload?.role;
  return typeof role === "string" ? role : undefined;
}

export function assertSupabaseCredentialNotPrivileged(
  raw: string,
  label: string,
): void {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `${label} must not be empty.`,
    );
  }
  if (trimmed.startsWith("sb_secret_")) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `${label} must not be a Supabase secret key.`,
    );
  }
  const lower = trimmed.toLowerCase();
  if (lower.includes("service_role") && !trimmed.startsWith("ey")) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `${label} must not be a service_role key.`,
    );
  }
  const role = readJwtRole(trimmed);
  if (role === "service_role") {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `${label} must not be a service_role JWT.`,
    );
  }
}
