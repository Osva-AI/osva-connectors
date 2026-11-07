import { ConnectorSdkError } from "@osva-ai/connector-sdk";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.goog",
  "0.0.0.0",
  "broadcasthost",
  "ip6-localhost",
  "ip6-loopback",
]);

const BLOCKED_TLD_SUFFIXES = [".local", ".internal", ".localhost"] as const;

function invalidUrlError(message: string): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", message);
}

function parseIpv4Octets(hostname: string): number[] | undefined {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return undefined;
  }
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return undefined;
    }
    const value = Number(part);
    if (value > 255) {
      return undefined;
    }
    octets.push(value);
  }
  return octets;
}

function isPrivateOrLoopbackIpv4(hostname: string): boolean {
  const octets = parseIpv4Octets(hostname);
  if (octets === undefined) {
    return false;
  }
  const [a, b] = octets;
  if (a === 127) {
    return true;
  }
  if (a === 10) {
    return true;
  }
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
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

function isPrivateOrLoopbackIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === "::1" || normalized === "::") {
    return true;
  }
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(lower)) {
    return true;
  }
  for (const suffix of BLOCKED_TLD_SUFFIXES) {
    if (lower === suffix.slice(1) || lower.endsWith(suffix)) {
      return true;
    }
  }
  if (isPrivateOrLoopbackIpv4(lower)) {
    return true;
  }
  if (lower.includes(":") && isPrivateOrLoopbackIpv6(lower)) {
    return true;
  }
  return false;
}

export function validateUserHttpsUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw invalidUrlError("URL is required.");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw invalidUrlError("URL is not valid.");
  }
  if (parsed.protocol !== "https:") {
    throw invalidUrlError("URL must use HTTPS.");
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw invalidUrlError("URL must not include embedded credentials.");
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw invalidUrlError("URL hostname is not allowed.");
  }
  return parsed.toString();
}

export function validateUserHttpsUrls(urls: readonly string[]): string[] {
  return urls.map((url) => validateUserHttpsUrl(url));
}
