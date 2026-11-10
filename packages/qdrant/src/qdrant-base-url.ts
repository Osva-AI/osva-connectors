import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_BASE_URL_LENGTH } from "./constants.js";

const LOCAL_HTTP_HOSTS = new Set(["localhost", "127.0.0.1"]);

function expandHostnameForIpCheck(hostname: string): string {
  const trimmed = hostname.replace(/^\[/, "").replace(/\]$/, "");
  return trimmed.toLowerCase();
}

function isPrivateOrLoopbackIpv6(hostname: string): boolean {
  const host = expandHostnameForIpCheck(hostname);
  if (host === "::1") {
    return true;
  }
  if (host.startsWith("fe80:")) {
    return true;
  }
  if (host.startsWith("fc") || host.startsWith("fd")) {
    return true;
  }
  if (host.startsWith("::ffff:")) {
    const mapped = host.slice("::ffff:".length);
    if (mapped.includes(".")) {
      return isPrivateOrLoopbackIpv4(mapped);
    }
  }
  return false;
}

function isPrivateOrLoopbackIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return false;
  }
  const octets = parts.map((p) => Number(p));
  if (octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
    return false;
  }
  const a = octets[0] ?? 0;
  const b = octets[1] ?? 0;
  if (a === 127 || a === 10 || a === 0) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  return false;
}

function isBlockedProductionHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, "");
  if (LOCAL_HTTP_HOSTS.has(lower)) {
    return false;
  }
  if (lower === "metadata.google.internal" || lower.endsWith(".internal")) {
    return true;
  }
  if (lower.endsWith(".local") || lower.endsWith(".localhost")) {
    return true;
  }
  if (isPrivateOrLoopbackIpv6(lower)) {
    return true;
  }
  return isPrivateOrLoopbackIpv4(lower);
}

export function parseQdrantBaseUrl(
  raw: string,
  allowLocalHttp: boolean,
): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_BASE_URL_LENGTH) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Qdrant URL is invalid.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Qdrant URL is invalid.",
    );
  }

  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Qdrant URL must not include embedded credentials.",
    );
  }

  const host = parsed.hostname.toLowerCase();

  if (parsed.protocol === "http:") {
    if (!allowLocalHttp) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Qdrant HTTP is not allowed. Set OSVA_CONNECTOR_QDRANT_ALLOW_LOCAL_HTTP=true for local testing.",
      );
    }
    if (!LOCAL_HTTP_HOSTS.has(host)) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Qdrant HTTP is only permitted for localhost or 127.0.0.1.",
      );
    }
  } else if (parsed.protocol === "https:") {
    if (isBlockedProductionHostname(host)) {
      throw new ConnectorSdkError(
        "CONFIGURATION_ERROR",
        "Qdrant URL must not target a private or restricted host.",
      );
    }
  } else {
    throw new ConnectorSdkError(
      "CONFIGURATION_ERROR",
      "Qdrant URL must use HTTPS (or HTTP for trusted local testing).",
    );
  }

  return parsed.toString().replace(/\/$/, "");
}
