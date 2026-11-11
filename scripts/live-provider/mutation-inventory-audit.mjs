/**
 * B5.5D: Cross-check MCP tool declarations vs mutation inventory.
 */
import fs from "node:fs/promises";
import path from "node:path";

import { loadConnectorPackages } from "../release/load-connector-packages.mjs";
import { MUTATION_CLASS, MUTATION_INVENTORY } from "./mutation-inventory.mjs";

const TOOL_NAME_PATTERN = /_TOOL\s*=\s*["']([^"']+)["']/g;

export const INVENTORY_COVERAGE = Object.freeze({
  VERIFIED_READ_ONLY: "VERIFIED_READ_ONLY",
  FULLY_CLASSIFIED: "FULLY_CLASSIFIED",
  PARTIALLY_CLASSIFIED: "PARTIALLY_CLASSIFIED",
  UNCLASSIFIED: "UNCLASSIFIED",
  STALE_INVENTORY: "STALE_INVENTORY",
});

/**
 * @param {string} repoRoot
 * @param {string} directory
 * @returns {Promise<string[] | null>}
 */
export async function loadDeclaredToolsFromPackage(repoRoot, directory) {
  const constantsPath = path.join(
    repoRoot,
    "packages",
    directory,
    "src",
    "constants.ts",
  );
  let text;
  try {
    text = await fs.readFile(constantsPath, "utf8");
  } catch {
    return null;
  }
  const tools = [];
  for (const match of text.matchAll(TOOL_NAME_PATTERN)) {
    tools.push(match[1]);
  }
  return [...new Set(tools)].sort((a, b) => a.localeCompare(b));
}

/**
 * @param {readonly string[] | undefined} classes
 */
export function toolHasMutationCapability(classes) {
  if (!classes?.length) {
    return undefined;
  }
  return classes.some((c) => c !== MUTATION_CLASS.READ_ONLY);
}

/**
 * @param {string} directory
 * @param {string} toolName
 * @returns {{ known: boolean; classes: string[] | null; failClosed: boolean }}
 */
export function classifyToolMutation(directory, toolName) {
  const inventory = MUTATION_INVENTORY[directory];
  if (!inventory) {
    return { known: false, classes: null, failClosed: true };
  }
  const classes = inventory[toolName];
  if (!classes?.length) {
    return { known: false, classes: null, failClosed: true };
  }
  return { known: true, classes: [...classes], failClosed: false };
}

/**
 * Live mutation paths must not authorize tools that are unknown or non-read-only
 * without explicit runner + approval (future milestone).
 *
 * @param {string} directory
 * @param {string} toolName
 */
export function assertToolAuthorizedForLiveMutation(directory, toolName) {
  const classification = classifyToolMutation(directory, toolName);
  if (!classification.known) {
    return {
      ok: false,
      reason: `tool ${toolName} is UNCLASSIFIED — fail closed`,
    };
  }
  const mutable = toolHasMutationCapability(classification.classes);
  if (mutable) {
    return {
      ok: false,
      reason: `tool ${toolName} requires live mutation milestone (not B5.5)`,
    };
  }
  return { ok: true, reason: "read-only tool" };
}

/**
 * @param {string} repoRoot
 * @param {string} directory
 */
export async function auditConnectorMutationInventory(repoRoot, directory) {
  const declared = await loadDeclaredToolsFromPackage(repoRoot, directory);
  if (declared === null) {
    return {
      directory,
      coverage: INVENTORY_COVERAGE.UNCLASSIFIED,
      declaredToolCount: 0,
      inventoryToolCount: 0,
      missingFromInventory: [],
      staleInventoryEntries: [],
      unclassifiedMutationTools: [],
      ok: false,
      detail: "no constants.ts tool declarations found",
    };
  }

  const inventory = MUTATION_INVENTORY[directory] ?? {};
  const inventoryKeys = Object.keys(inventory);
  const missingFromInventory = declared.filter((t) => !(t in inventory));
  const staleInventoryEntries = inventoryKeys.filter(
    (t) => !declared.includes(t),
  );

  const unclassifiedMutationTools = declared.filter((tool) => {
    const hint =
      /(?:\.|^)(?:create|update|delete|upload|upsert|send|replace|append|set|write|post|put|patch|destroy)\b/i.test(
        tool,
      );
    if (!hint) {
      return false;
    }
    const cls = inventory[tool];
    return !cls || cls.length === 0;
  });

  let coverage = INVENTORY_COVERAGE.UNCLASSIFIED;
  if (staleInventoryEntries.length > 0) {
    coverage = INVENTORY_COVERAGE.STALE_INVENTORY;
  } else if (missingFromInventory.length === 0 && inventoryKeys.length > 0) {
    const anyMutation = inventoryKeys.some((t) =>
      toolHasMutationCapability(inventory[t]),
    );
    coverage = anyMutation
      ? INVENTORY_COVERAGE.FULLY_CLASSIFIED
      : INVENTORY_COVERAGE.VERIFIED_READ_ONLY;
  } else if (inventoryKeys.length === 0) {
    coverage =
      unclassifiedMutationTools.length > 0
        ? INVENTORY_COVERAGE.UNCLASSIFIED
        : INVENTORY_COVERAGE.VERIFIED_READ_ONLY;
  } else if (missingFromInventory.length > 0) {
    coverage = INVENTORY_COVERAGE.PARTIALLY_CLASSIFIED;
  }

  const ok =
    staleInventoryEntries.length === 0 &&
    coverage !== INVENTORY_COVERAGE.UNCLASSIFIED;

  return {
    directory,
    coverage,
    declaredToolCount: declared.length,
    inventoryToolCount: inventoryKeys.length,
    missingFromInventory,
    staleInventoryEntries,
    unclassifiedMutationTools,
    ok,
    detail: ok
      ? `${coverage}: ${declared.length} declared tools aligned`
      : [
          staleInventoryEntries.length
            ? `stale inventory: ${staleInventoryEntries.slice(0, 5).join(", ")}`
            : null,
          missingFromInventory.length
            ? `missing classification: ${missingFromInventory.length} tool(s)`
            : null,
          unclassifiedMutationTools.length
            ? `mutation-like tools without class: ${unclassifiedMutationTools
                .slice(0, 5)
                .join(", ")}`
            : null,
        ]
          .filter(Boolean)
          .join("; ") || "inventory incomplete",
  };
}

/**
 * @param {string} repoRoot
 */
export async function auditAllConnectorMutationInventories(repoRoot) {
  const connectors = await loadConnectorPackages(repoRoot);
  const audits = [];
  for (const connector of connectors) {
    audits.push(
      await auditConnectorMutationInventory(repoRoot, connector.directory),
    );
  }
  return audits;
}

/**
 * Preflight integrity: structural inventory errors fail; partial coverage is reported.
 *
 * @param {string} repoRoot
 * @param {string} directory
 */
export async function verifyMutationInventoryPreflight(repoRoot, directory) {
  const { verifyMutationInventory } = await import("./mutation-inventory.mjs");
  const structural = verifyMutationInventory(directory);
  if (!structural.ok) {
    return structural;
  }
  const audit = await auditConnectorMutationInventory(repoRoot, directory);
  if (audit.staleInventoryEntries.length > 0) {
    return {
      ok: false,
      detail: audit.detail,
      toolCount: audit.inventoryToolCount,
      coverage: audit.coverage,
    };
  }
  if (audit.coverage === INVENTORY_COVERAGE.UNCLASSIFIED) {
    return {
      ok: false,
      detail: audit.detail,
      toolCount: audit.declaredToolCount,
      coverage: audit.coverage,
    };
  }
  return {
    ok: true,
    detail: `${audit.coverage}: ${audit.detail}`,
    toolCount: Math.max(audit.declaredToolCount, audit.inventoryToolCount),
    coverage: audit.coverage,
  };
}
