import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_TARGET_URL_LENGTH } from "./constants.js";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google",
  "metadata.google.internal",
]);

const BLOCKED_HOST_SUFFIXES = [".metadata.google", ".metadata.google.internal"];

function isIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    const n = Number(part);
    return Number.isInteger(n) && n >= 0 && n <= 255;
  });
}

function isPrivateIpv4(hostname: string): boolean {
  if (!isIpv4(hostname)) {
    return false;
  }
  const octets = hostname.split(".").map(Number);
  const a = octets[0];
  const b = octets[1];
  if (a === undefined || b === undefined) {
    return false;
  }
  if (a === 10) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 0) {
    return true;
  }
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (normalized.length === 0) {
    return true;
  }
  if (BLOCKED_HOSTNAMES.has(normalized)) {
    return true;
  }
  if (normalized === "::1" || normalized.startsWith("fe80:")) {
    return true;
  }
  for (const suffix of BLOCKED_HOST_SUFFIXES) {
    if (normalized.endsWith(suffix)) {
      return true;
    }
  }
  if (isPrivateIpv4(normalized)) {
    return true;
  }
  return false;
}

function normalizeBareHostToHttps(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Validates a user-supplied HTTPS target URL for extract/crawl tools.
 * Rejects private, loopback, and cloud metadata hosts.
 */
export function parseHttpsTargetUrl(raw: string, label = "URL"): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_TARGET_URL_LENGTH) {
    throw new ConnectorSdkError("INVALID_INPUT", `${label} is not valid.`);
  }

  const candidate = normalizeBareHostToHttps(trimmed);
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new ConnectorSdkError("INVALID_INPUT", `${label} is not valid.`);
  }

  if (parsed.protocol !== "https:") {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `${label} must use the https scheme.`,
    );
  }

  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new ConnectorSdkError("INVALID_INPUT", `${label} is not valid.`);
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      `${label} must not target a private or restricted host.`,
    );
  }

  return parsed.toString();
}
