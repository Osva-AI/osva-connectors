/**
 * B5.5A: Opt-in gates for live provider traffic and mutations.
 */

export const GATE_EXECUTE = "OSVA_LIVE_PROVIDER_EXECUTE";
export const GATE_MUTATIONS = "OSVA_LIVE_PROVIDER_MUTATIONS_APPROVED";
export const GATE_DESTRUCTIVE = "OSVA_LIVE_PROVIDER_DESTRUCTIVE_APPROVED";
export const GATE_MOCK_FIXTURES = "OSVA_LIVE_PROVIDER_RUN_MOCK_FIXTURES";

export function flagEnabled(name) {
  const raw = process.env[name];
  if (raw === undefined) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function isLiveExecutionEnabled() {
  return flagEnabled(GATE_EXECUTE);
}

export function areMutationsApproved() {
  return flagEnabled(GATE_MUTATIONS);
}

export function areDestructiveApproved() {
  return flagEnabled(GATE_DESTRUCTIVE);
}

export function shouldRunMockFixtures(cliMockFlag) {
  return cliMockFlag || flagEnabled(GATE_MOCK_FIXTURES);
}

export function envValueReady(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

export function anyEnvReady(names) {
  return names.some((name) => envValueReady(name));
}

/** Default mutation-related connector flags that must stay off unless mutations are approved. */
export const MUTATION_POLICY_ENV_NAMES = Object.freeze([
  "OSVA_CONNECTOR_S3_CREATE_ENABLED",
  "OSVA_CONNECTOR_S3_REPLACE_ENABLED",
  "OSVA_CONNECTOR_S3_HOST_WRITES_APPROVED",
  "OSVA_CONNECTOR_GCS_CREATE_ENABLED",
  "OSVA_CONNECTOR_GCS_REPLACE_ENABLED",
  "OSVA_CONNECTOR_GCS_HOST_WRITES_APPROVED",
  "OSVA_CONNECTOR_AZURE_BLOB_CREATE_ENABLED",
  "OSVA_CONNECTOR_AZURE_BLOB_REPLACE_ENABLED",
  "OSVA_CONNECTOR_AZURE_BLOB_HOST_WRITES_APPROVED",
  "OSVA_CONNECTOR_NOTION_WRITE_ENABLED",
  "OSVA_CONNECTOR_NOTION_HOST_WRITES_APPROVED",
  "OSVA_CONNECTOR_LINEAR_WRITE_ENABLED",
  "OSVA_CONNECTOR_LINEAR_HOST_MUTATIONS_APPROVED",
  "OSVA_CONNECTOR_JIRA_WRITE_ENABLED",
  "OSVA_CONNECTOR_JIRA_HOST_WRITES_APPROVED",
  "OSVA_CONNECTOR_QDRANT_WRITE_ENABLED",
  "OSVA_CONNECTOR_QDRANT_HOST_WRITES_APPROVED",
  "OSVA_CONNECTOR_PINECONE_WRITE_ENABLED",
  "OSVA_CONNECTOR_PINECONE_HOST_WRITES_APPROVED",
]);

export function evaluateMutationPolicy(env = process.env) {
  if (areMutationsApproved()) {
    return { ok: true, violations: [] };
  }
  const violations = [];
  for (const name of MUTATION_POLICY_ENV_NAMES) {
    const raw = env[name];
    if (raw === undefined || raw.trim().length === 0) {
      continue;
    }
    const normalized = raw.trim().toLowerCase();
    if (normalized === "1" || normalized === "true" || normalized === "yes") {
      violations.push(name);
    }
  }
  return { ok: violations.length === 0, violations };
}
