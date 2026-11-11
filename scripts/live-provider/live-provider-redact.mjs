/**
 * B5.5A: Redact credential-like substrings before writing logs or reports.
 */
import { redactSecrets as redactNpmSecrets } from "../release/classify-npm-view-result.mjs";

const CONNECTOR_SECRET_PATTERNS = [
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\b(ASIA)[0-9A-Z]{16}\b/g,
  /\bsk_live_[a-zA-Z0-9]{20,}\b/g,
  /\bsk_test_[a-zA-Z0-9]{20,}\b/g,
  /\bghp_[a-zA-Z0-9]{20,}\b/g,
  /\bgithub_pat_[a-zA-Z0-9_]{20,}\b/g,
  /\bBearer\s+ey[a-zA-Z0-9._-]{20,}\b/gi,
  /\bxox[baprs]-[a-zA-Z0-9-]{10,}\b/g,
];

const ENV_VALUE_PATTERN =
  /((?:OSVA_CONNECTOR_[A-Z0-9_]+|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GOOGLE_APPLICATION_CREDENTIALS)=)([^\s\r\n]+)/g;

const POSTGRES_URL_PATTERN = /\bpostgres(?:ql)?:\/\/[^@\s]+@[^\s]+/gi;

export function redactLiveProviderSecrets(text) {
  let out = redactNpmSecrets(String(text ?? ""));
  for (const pattern of CONNECTOR_SECRET_PATTERNS) {
    out = out.replace(pattern, "[redacted]");
  }
  out = out.replace(ENV_VALUE_PATTERN, (_, prefix) => `${prefix}[redacted]`);
  out = out.replace(POSTGRES_URL_PATTERN, "postgresql://[redacted]");
  return out;
}

export function redactReportObject(value) {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return redactLiveProviderSecrets(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactReportObject(item));
  }
  if (typeof value === "object") {
    const next = {};
    for (const [key, val] of Object.entries(value)) {
      next[key] = redactReportObject(val);
    }
    return next;
  }
  return value;
}
