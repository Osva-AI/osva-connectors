import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  LINEAR_ACCESS_TOKEN_ENV,
  LINEAR_ALLOWED_TEAM_IDS_ENV,
  LINEAR_API_KEY_ENV,
  LINEAR_HOST_MUTATIONS_APPROVED_ENV,
  LINEAR_TIMEOUT_MS_ENV,
  LINEAR_WRITE_ENABLED_ENV,
} from "./constants.js";
import { parseLinearId } from "./linear-id.js";
import { linearConfigSchema, type LinearConfig } from "./schemas.js";

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

function parseAllowedTeamIds(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim().length === 0) {
    return [];
  }
  const ids: string[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (trimmed.length === 0) {
      continue;
    }
    ids.push(parseLinearId(trimmed, "team ID"));
  }
  return ids;
}

function resolveAuth(env: NodeJS.ProcessEnv): {
  readonly authorizationHeader: string;
  readonly credentialForRedaction: string;
} {
  const apiKey = env[LINEAR_API_KEY_ENV]?.trim();
  const accessToken = env[LINEAR_ACCESS_TOKEN_ENV]?.trim();

  if (
    (apiKey === undefined || apiKey.length === 0) &&
    (accessToken === undefined || accessToken.length === 0)
  ) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Linear API key or OAuth access token is required.",
    );
  }

  if (apiKey !== undefined && apiKey.length > 0) {
    return {
      authorizationHeader: apiKey,
      credentialForRedaction: apiKey,
    };
  }

  return {
    authorizationHeader: `Bearer ${accessToken}`,
    credentialForRedaction: accessToken!,
  };
}

export function loadLinearConfig(
  env: NodeJS.ProcessEnv = process.env,
): LinearConfig {
  const auth = resolveAuth(env);

  const requestTimeoutMs = readBoundedInt(
    env[LINEAR_TIMEOUT_MS_ENV],
    DEFAULT_REQUEST_TIMEOUT_MS,
    "Request timeout",
  );
  const writeEnabled = parseBooleanFlag(env[LINEAR_WRITE_ENABLED_ENV], false);
  const hostMutationsApproved = parseBooleanFlag(
    env[LINEAR_HOST_MUTATIONS_APPROVED_ENV],
    false,
  );
  const allowedTeamIds = parseAllowedTeamIds(env[LINEAR_ALLOWED_TEAM_IDS_ENV]);

  const parsed = linearConfigSchema.safeParse({
    authorizationHeader: auth.authorizationHeader,
    credentialForRedaction: auth.credentialForRedaction,
    requestTimeoutMs,
    writeEnabled,
    hostMutationsApproved,
    allowedTeamIds,
  });

  if (!parsed.success) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Linear connector configuration is invalid.",
    );
  }

  return parsed.data;
}
