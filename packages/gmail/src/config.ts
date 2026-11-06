import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  GMAIL_ACCESS_TOKEN_ENV,
  GMAIL_ALLOWED_RECIPIENTS_ENV,
  GMAIL_DELEGATED_USER_EMAIL_ENV,
  GMAIL_DRAFTS_ENABLED_ENV,
  GMAIL_HOST_SEND_APPROVED_ENV,
  GMAIL_SCOPES_ENV,
  GMAIL_SEND_ENABLED_ENV,
  GMAIL_TIMEOUT_MS_ENV,
  GMAIL_USE_DOMAIN_DELEGATION_ENV,
  GMAIL_COMPOSE_SCOPE,
  GMAIL_READONLY_SCOPE,
  GMAIL_SEND_SCOPE,
} from "./constants.js";
import { parseAllowlistEmailEntry } from "./email-address.js";
import { gmailConfigSchema, type GmailConfig } from "./schemas.js";

function readBoundedInt(
  raw: string | undefined,
  fallback: number,
  label: string,
): number {
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }
  const value = Number(raw.trim());
  if (!Number.isInteger(value)) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      `${label} must be an integer.`,
    );
  }
  return value;
}

function parseBooleanFlag(raw: string | undefined, fallback: false): boolean {
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  throw new ConnectorSdkError(
    "CONFIGURATION_ERROR",
    "Boolean environment flag must be true or false.",
  );
}

function parseAllowedRecipients(raw: string | undefined): string[] | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  const parts = raw.split(",").map((part) => part.trim());
  const canonical: string[] = [];
  for (const p of parts) {
    if (p.length === 0) {
      continue;
    }
    canonical.push(parseAllowlistEmailEntry(p));
  }
  if (canonical.length === 0) {
    return undefined;
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const email of canonical) {
    if (seen.has(email)) {
      continue;
    }
    seen.add(email);
    out.push(email);
  }
  return out;
}

function parseScopes(raw: string | undefined): string[] | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  const parts = raw
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts.length > 0 ? parts : undefined;
}

function resolveDefaultScopes(config: {
  readonly draftsEnabled: boolean;
  readonly sendEnabled: boolean;
}): readonly string[] {
  const scopes = new Set<string>([GMAIL_READONLY_SCOPE]);
  if (config.draftsEnabled) {
    scopes.add(GMAIL_COMPOSE_SCOPE);
  }
  if (config.sendEnabled) {
    scopes.add(GMAIL_SEND_SCOPE);
  }
  return [...scopes];
}

export function loadGmailConfig(
  env: NodeJS.ProcessEnv = process.env,
): GmailConfig {
  const requestTimeoutMs = readBoundedInt(
    env[GMAIL_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );

  const rawAccess = env[GMAIL_ACCESS_TOKEN_ENV];
  const accessToken =
    rawAccess !== undefined && rawAccess.trim().length > 0
      ? rawAccess.trim()
      : undefined;

  const scopesFromEnv = parseScopes(env[GMAIL_SCOPES_ENV]);
  const useDomainDelegation = parseBooleanFlag(
    env[GMAIL_USE_DOMAIN_DELEGATION_ENV],
    false,
  );
  const delegatedRaw = env[GMAIL_DELEGATED_USER_EMAIL_ENV];
  const delegatedUserEmail =
    delegatedRaw !== undefined && delegatedRaw.trim().length > 0
      ? delegatedRaw.trim()
      : undefined;

  const draftsEnabled = parseBooleanFlag(env[GMAIL_DRAFTS_ENABLED_ENV], false);
  const sendEnabled = parseBooleanFlag(env[GMAIL_SEND_ENABLED_ENV], false);
  const hostSendApproved = parseBooleanFlag(
    env[GMAIL_HOST_SEND_APPROVED_ENV],
    false,
  );
  const allowedRecipients = parseAllowedRecipients(
    env[GMAIL_ALLOWED_RECIPIENTS_ENV],
  );

  const scopes =
    scopesFromEnv ?? resolveDefaultScopes({ draftsEnabled, sendEnabled });

  const parsed = gmailConfigSchema.safeParse({
    requestTimeoutMs,
    ...(accessToken !== undefined ? { accessToken } : {}),
    scopes,
    useDomainDelegation,
    ...(delegatedUserEmail !== undefined ? { delegatedUserEmail } : {}),
    draftsEnabled,
    sendEnabled,
    hostSendApproved,
    allowedRecipients,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Gmail connector configuration is invalid.",
    );
  }

  if (parsed.data.useDomainDelegation && accessToken !== undefined) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Do not set both domain-wide delegation and a static access token.",
    );
  }

  if (
    (parsed.data.draftsEnabled === true || parsed.data.sendEnabled === true) &&
    (parsed.data.allowedRecipients === undefined ||
      parsed.data.allowedRecipients.length === 0)
  ) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Draft or send enablement requires OSVA_CONNECTOR_GMAIL_ALLOWED_RECIPIENTS.",
    );
  }

  return parsed.data;
}
