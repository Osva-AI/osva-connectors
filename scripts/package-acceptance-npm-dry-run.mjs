/**
 * npm publish --dry-run checks for package acceptance (not release eligibility).
 */
import { spawnSync } from "node:child_process";

export const NPM_BIN_STRIP_PATTERN_GITHUB =
  /bin\[osva-connector-github\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_POSTGRES =
  /bin\[osva-connector-postgres\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_SHOPIFY =
  /bin\[osva-connector-shopify\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_GA4 =
  /bin\[osva-connector-ga4\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_GSC =
  /bin\[osva-connector-gsc\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_SLACK =
  /bin\[osva-connector-slack\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_GOOGLE_DRIVE =
  /bin\[osva-connector-google-drive\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_GOOGLE_SHEETS =
  /bin\[osva-connector-google-sheets\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_GOOGLE_ADS =
  /bin\[osva-connector-google-ads\].*invalid and removed/i;

const VERSION_ALREADY_PUBLISHED =
  /cannot publish over the previously published versions/i;

/**
 * @param {{ status: number | null; stdout?: string; stderr?: string }} result
 * @param {RegExp} binStripPattern
 * @returns {"ok" | "version_already_published"}
 */
export function classifyNpmPublishDryRunForAcceptance(result, binStripPattern) {
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (binStripPattern.test(combined)) {
    throw new Error(
      `npm publish --dry-run would strip bin (fix package.json bin map):\n${combined}`,
    );
  }
  if (result.status === 0) {
    return "ok";
  }
  if (VERSION_ALREADY_PUBLISHED.test(combined)) {
    return "version_already_published";
  }
  throw new Error(
    `npm publish --dry-run failed (${result.status}):\n${combined}`,
  );
}

/**
 * @param {string} cwd
 * @param {RegExp} binStripPattern
 * @param {string[]} [extraArgs]
 * @returns {"ok" | "version_already_published"}
 */
export function runNpmPublishDryRunForAcceptance(
  cwd,
  binStripPattern,
  extraArgs = [],
) {
  const result = spawnSync(
    "npm",
    ["publish", "--dry-run", "--access", "public", ...extraArgs],
    {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    },
  );
  return classifyNpmPublishDryRunForAcceptance(result, binStripPattern);
}
