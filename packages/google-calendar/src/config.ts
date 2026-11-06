import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  CAL_ALLOWED_CALENDARS_ENV,
  CAL_ACCESS_TOKEN_ENV,
  CAL_DELEGATED_USER_EMAIL_ENV,
  CAL_HOST_MUTATIONS_APPROVED_ENV,
  CAL_SCOPES_ENV,
  CAL_TIMEOUT_MS_ENV,
  CAL_USE_DOMAIN_DELEGATION_ENV,
  CAL_WRITE_ENABLED_ENV,
  CALENDAR_EVENTS_SCOPE,
  CALENDAR_READONLY_SCOPE,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from "./constants.js";
import {
  googleCalendarConfigSchema,
  type GoogleCalendarConfig,
} from "./schemas.js";

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

/**
 * `undefined` — env var absent: no allowlist (all calendar ids allowed for reads).
 * `[]` — env var present but empty/whitespace-only: explicit deny-all allowlist.
 */
function parseAllowedCalendars(raw: string | undefined): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw.trim().length === 0) {
    return [];
  }
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (seen.has(p)) {
      continue;
    }
    seen.add(p);
    out.push(p);
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

function defaultScopes(writeEnabled: boolean): readonly string[] {
  if (writeEnabled) {
    return [CALENDAR_READONLY_SCOPE, CALENDAR_EVENTS_SCOPE];
  }
  return [CALENDAR_READONLY_SCOPE];
}

export function loadGoogleCalendarConfig(
  env: NodeJS.ProcessEnv = process.env,
): GoogleCalendarConfig {
  const requestTimeoutMs = readBoundedInt(
    env[CAL_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );

  const rawAccess = env[CAL_ACCESS_TOKEN_ENV];
  const accessToken =
    rawAccess !== undefined && rawAccess.trim().length > 0
      ? rawAccess.trim()
      : undefined;

  const writeEnabled = parseBooleanFlag(env[CAL_WRITE_ENABLED_ENV], false);
  const hostMutationsApproved = parseBooleanFlag(
    env[CAL_HOST_MUTATIONS_APPROVED_ENV],
    false,
  );
  const useDomainDelegation = parseBooleanFlag(
    env[CAL_USE_DOMAIN_DELEGATION_ENV],
    false,
  );
  const delegatedRaw = env[CAL_DELEGATED_USER_EMAIL_ENV];
  const delegatedUserEmail =
    delegatedRaw !== undefined && delegatedRaw.trim().length > 0
      ? delegatedRaw.trim()
      : undefined;

  const allowedCalendarIds = parseAllowedCalendars(
    env[CAL_ALLOWED_CALENDARS_ENV],
  );

  const scopesFromEnv = parseScopes(env[CAL_SCOPES_ENV]);
  const scopes = scopesFromEnv ?? [...defaultScopes(writeEnabled)];

  const parsed = googleCalendarConfigSchema.safeParse({
    requestTimeoutMs,
    ...(accessToken !== undefined ? { accessToken } : {}),
    scopes,
    useDomainDelegation,
    ...(delegatedUserEmail !== undefined ? { delegatedUserEmail } : {}),
    writeEnabled,
    hostMutationsApproved,
    allowedCalendarIds,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Google Calendar connector configuration is invalid.",
    );
  }

  if (parsed.data.useDomainDelegation && accessToken !== undefined) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Do not set both domain-wide delegation and a static access token.",
    );
  }

  if (parsed.data.writeEnabled && !parsed.data.hostMutationsApproved) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Write enablement requires OSVA_CONNECTOR_GOOGLE_CALENDAR_HOST_MUTATIONS_APPROVED=true.",
    );
  }

  if (
    (parsed.data.writeEnabled === true ||
      parsed.data.hostMutationsApproved === true) &&
    parsed.data.allowedCalendarIds === undefined
  ) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Calendar mutation flags require OSVA_CONNECTOR_GOOGLE_CALENDAR_ALLOWED_CALENDAR_IDS to be set (comma-separated ids, or an explicit empty value to deny all calendar access).",
    );
  }

  return parsed.data;
}
