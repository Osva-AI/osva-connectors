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

export const NPM_BIN_STRIP_PATTERN_MIXPANEL =
  /bin\[osva-connector-mixpanel\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_GSC =
  /bin\[osva-connector-gsc\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_SLACK =
  /bin\[osva-connector-slack\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_GOOGLE_DRIVE =
  /bin\[osva-connector-google-drive\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_GMAIL =
  /bin\[osva-connector-gmail\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_GOOGLE_CALENDAR =
  /bin\[osva-connector-google-calendar\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_GOOGLE_SHEETS =
  /bin\[osva-connector-google-sheets\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_GOOGLE_ADS =
  /bin\[osva-connector-google-ads\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_META_ADS =
  /bin\[osva-connector-meta-ads\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_KLAVIYO =
  /bin\[osva-connector-klaviyo\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_WHATSAPP =
  /bin\[osva-connector-whatsapp\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_HUBSPOT =
  /bin\[osva-connector-hubspot\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_STRIPE =
  /bin\[osva-connector-stripe\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_NPM =
  /bin\[osva-connector-npm\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_NOTION =
  /bin\[osva-connector-notion\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_LINEAR =
  /bin\[osva-connector-linear\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_EXA =
  /bin\[osva-connector-exa\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_TAVILY =
  /bin\[osva-connector-tavily\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_FIRECRAWL =
  /bin\[osva-connector-firecrawl\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_QDRANT =
  /bin\[osva-connector-qdrant\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_PINECONE =
  /bin\[osva-connector-pinecone\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_JIRA =
  /bin\[osva-connector-jira\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_CONFLUENCE =
  /bin\[osva-connector-confluence\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_OUTLOOK =
  /bin\[osva-connector-outlook\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_ONEDRIVE =
  /bin\[osva-connector-onedrive\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_TEAMS =
  /bin\[osva-connector-teams\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_AMPLITUDE =
  /bin\[osva-connector-amplitude\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_WOOCOMMERCE =
  /bin\[osva-connector-woocommerce\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_BIGCOMMERCE =
  /bin\[osva-connector-bigcommerce\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_ZENDESK =
  /bin\[osva-connector-zendesk\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_INTERCOM =
  /bin\[osva-connector-intercom\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_FRESHDESK =
  /bin\[osva-connector-freshdesk\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_SALESFORCE =
  /bin\[osva-connector-salesforce\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_PIPEDRIVE =
  /bin\[osva-connector-pipedrive\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_ZOHO_CRM =
  /bin\[osva-connector-zoho-crm\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_AWS_S3 =
  /bin\[osva-connector-aws-s3\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_GCS =
  /bin\[osva-connector-gcs\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_BIGQUERY =
  /bin\[osva-connector-bigquery\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_AZURE_BLOB =
  /bin\[osva-connector-azure-blob\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_SNOWFLAKE =
  /bin\[osva-connector-snowflake\].*invalid and removed/i;

export const NPM_BIN_STRIP_PATTERN_SUPABASE =
  /bin\[osva-connector-supabase\].*invalid and removed/i;

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
  const npmArgs = ["publish", "--dry-run", "--access", "public", ...extraArgs];
  const result =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", "npm", ...npmArgs], {
          cwd,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          shell: false,
        })
      : spawnSync("npm", npmArgs, {
          cwd,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          shell: false,
        });
  return classifyNpmPublishDryRunForAcceptance(result, binStripPattern);
}
