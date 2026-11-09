/**
 * Classify `npm view <pkg>@<version> version` without treating every
 * nonzero exit as "unpublished". Fail closed on unknown errors.
 */

export const NPM_VIEW_KIND = Object.freeze({
  published: "published",
  unpublished: "unpublished",
  authFailure: "auth_failure",
  networkFailure: "network_failure",
  registryFailure: "registry_failure",
  unknown: "unknown",
});

const AUTH_PATTERN =
  /\b(E401|E403|ENEEDAUTH|401 Unauthorized|403 Forbidden)\b/i;
const NOT_FOUND_PATTERN = /\b(E404|404 Not Found|404 Not Found - GET)\b/i;
const NETWORK_PATTERN =
  /\b(ENOTFOUND|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|ECONNRESET|ECONNREFUSED|ENETDOWN|ESOCKETTIMEDOUT|ENETUNREACH|network(?:\s+request)?)\b/i;
const REGISTRY_PATTERN =
  /\b(E500|E502|E503|E504|500 Internal|502 Bad Gateway|503 Service|504 Gateway|registry error|unable to connect to the npm registry)\b/i;

export function redactSecrets(text) {
  return String(text ?? "")
    .replace(/(_authToken=)\S+/gi, "$1[redacted]")
    .replace(/(NPM_TOKEN=)\S+/gi, "$1[redacted]")
    .replace(/\bnpm_[A-Za-z0-9._-]{20,}\b/g, "[redacted-npm-token]");
}

function combinedOutput(stdout, stderr) {
  return `${stdout ?? ""}\n${stderr ?? ""}`;
}

function normalizeVersionToken(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) {
    return "";
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "string") {
      return parsed;
    }
  } catch {
    // Use the raw token when npm prints a plain version string.
  }
  return trimmed.split(/\s+/)[0] ?? "";
}

export function classifyNpmViewResult({
  status,
  stdout = "",
  stderr = "",
  expectedVersion,
}) {
  const output = combinedOutput(stdout, stderr);
  const redacted = redactSecrets(output);

  if (status === 0) {
    const viewed = normalizeVersionToken(stdout);
    if (viewed && viewed === expectedVersion) {
      return {
        kind: NPM_VIEW_KIND.published,
        message: `Version ${expectedVersion} is already published (immutable).`,
      };
    }
    return {
      kind: NPM_VIEW_KIND.unknown,
      message: `npm view succeeded but did not return expected version ${expectedVersion}; refusing to treat it as unpublished.`,
    };
  }

  if (AUTH_PATTERN.test(output)) {
    return {
      kind: NPM_VIEW_KIND.authFailure,
      message: `npm view authentication or authorization failed for ${expectedVersion}; refusing to publish.\n${redacted}`,
    };
  }

  if (NETWORK_PATTERN.test(output)) {
    return {
      kind: NPM_VIEW_KIND.networkFailure,
      message: `npm view network failure while checking ${expectedVersion}; refusing to publish.\n${redacted}`,
    };
  }

  if (REGISTRY_PATTERN.test(output)) {
    return {
      kind: NPM_VIEW_KIND.registryFailure,
      message: `npm registry service failure while checking ${expectedVersion}; refusing to publish.\n${redacted}`,
    };
  }

  if (NOT_FOUND_PATTERN.test(output)) {
    return {
      kind: NPM_VIEW_KIND.unpublished,
      message: `Version ${expectedVersion} is not published (ok to upload).`,
    };
  }

  return {
    kind: NPM_VIEW_KIND.unknown,
    message: `npm view failed with an unrecognized error while checking ${expectedVersion}; refusing to publish.\n${redacted}`,
  };
}
