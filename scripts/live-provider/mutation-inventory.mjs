/**
 * B5.5C / B5.5D: MCP tool mutation classification.
 * Inventory body: mutation-inventory.generated.mjs (see build-mutation-inventory.mjs).
 * Unknown tools at execution boundaries must fail closed (mutation-inventory-audit.mjs).
 */

export const MUTATION_CLASS = Object.freeze({
  READ_ONLY: "READ_ONLY",
  REVERSIBLE_MUTATION: "REVERSIBLE_MUTATION",
  IRREVERSIBLE_MUTATION: "IRREVERSIBLE_MUTATION",
  DESTRUCTIVE: "DESTRUCTIVE",
  FINANCIALLY_SENSITIVE: "FINANCIALLY_SENSITIVE",
  EXTERNAL_COMMUNICATION: "EXTERNAL_COMMUNICATION",
});

import { MUTATION_INVENTORY as GENERATED_MUTATION_INVENTORY } from "./mutation-inventory.generated.mjs";

export const MUTATION_INVENTORY = GENERATED_MUTATION_INVENTORY;

export const SAAS_PRIORITY_T0 = Object.freeze([
  "github",
  "stripe",
  "shopify",
  "woocommerce",
  "bigcommerce",
  "zendesk",
  "intercom",
  "freshdesk",
  "jira",
  "linear",
  "notion",
]);

export const SAAS_PRIORITY_T1 = Object.freeze([
  "outlook",
  "onedrive",
  "teams",
  "confluence",
  "gmail",
  "google-drive",
  "google-calendar",
  "google-sheets",
]);

export const SAAS_PRIORITY_T2 = Object.freeze([
  "ga4",
  "google-ads",
  "mixpanel",
  "amplitude",
  "firecrawl",
  "meta-ads",
  "hubspot",
  "slack",
]);

/**
 * @param {string} directory
 * @returns {{ ok: boolean; detail: string; toolCount: number }}
 */
export function verifyMutationInventory(directory) {
  const inventory = MUTATION_INVENTORY[directory];
  if (inventory === undefined) {
    return {
      ok: false,
      detail:
        "connector missing mutation inventory (fail closed — run build-mutation-inventory.mjs)",
      toolCount: 0,
    };
  }
  const entries = Object.entries(inventory);
  for (const [tool, classes] of entries) {
    if (!Array.isArray(classes) || classes.length === 0) {
      return {
        ok: false,
        detail: `tool ${tool} has empty classification (fail closed)`,
        toolCount: entries.length,
      };
    }
    for (const cls of classes) {
      if (!Object.values(MUTATION_CLASS).includes(cls)) {
        return {
          ok: false,
          detail: `tool ${tool} has unknown class ${cls}`,
          toolCount: entries.length,
        };
      }
    }
  }
  return {
    ok: true,
    detail: `inventory covers ${entries.length} tools`,
    toolCount: entries.length,
  };
}

/**
 * @param {string} directory
 * @returns {string}
 */
export function mutationSummaryForMatrix(directory) {
  const inv = MUTATION_INVENTORY[directory];
  if (!inv) {
    return "read-only inventory pending / none";
  }
  const mutating = Object.values(inv).filter((classes) =>
    classes.some((c) => c !== MUTATION_CLASS.READ_ONLY),
  ).length;
  return `${Object.keys(inv).length} tools; ${mutating} mutation-capable`;
}
