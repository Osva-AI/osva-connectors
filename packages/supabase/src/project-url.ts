import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { SUPABASE_REST_PATH } from "./constants.js";

export interface ParsedSupabaseProjectUrl {
  readonly projectUrl: string;
  readonly pinnedOrigin: string;
  readonly restBaseUrl: string;
  readonly projectRef: string;
}

function extractProjectRef(hostname: string): string {
  const match = /^([a-z0-9]+)\.supabase\.co$/i.exec(hostname);
  if (match !== null && match[1] !== undefined) {
    return match[1];
  }
  return hostname.replaceAll(".", "_");
}

export function parseSupabaseProjectUrl(
  raw: string,
  allowTestApiHost: boolean,
): ParsedSupabaseProjectUrl {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Supabase project URL is not valid.",
    );
  }
  if (parsed.protocol !== "https:") {
    const isLocal =
      parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
    if (!(allowTestApiHost && isLocal && parsed.protocol === "http:")) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Supabase project URL must use HTTPS.",
      );
    }
  }
  const projectUrl = parsed.origin;
  const restBaseUrl = `${projectUrl}${SUPABASE_REST_PATH}`;
  return {
    projectUrl,
    pinnedOrigin: parsed.origin,
    restBaseUrl,
    projectRef: extractProjectRef(parsed.hostname),
  };
}
