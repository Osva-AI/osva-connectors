/**
 * One-shot generator: declared MCP tools → mutation inventory entries.
 * Run: node scripts/live-provider/build-mutation-inventory.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadConnectorPackages } from "../release/load-connector-packages.mjs";
import { loadDeclaredToolsFromPackage } from "./mutation-inventory-audit.mjs";
import { MUTATION_CLASS } from "./mutation-inventory.mjs";

const ROOT = path.dirname(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
);

/** @type {Record<string, Record<string, readonly string[]>>} */
const MANUAL_OVERRIDES = {
  github: {
    "github.issue.create": [MUTATION_CLASS.REVERSIBLE_MUTATION],
    "github.issue.comment.create": [
      MUTATION_CLASS.REVERSIBLE_MUTATION,
      MUTATION_CLASS.EXTERNAL_COMMUNICATION,
    ],
  },
  stripe: {
    "stripe.account.get": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "stripe.balance.get": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "stripe.balanceTransaction.list": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "stripe.charge.list": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "stripe.customer.get": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "stripe.invoice.list": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "stripe.paymentIntent.get": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "stripe.paymentIntent.list": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "stripe.refund.list": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "stripe.subscription.list": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
  },
};

/**
 * @param {string} tool
 * @returns {readonly string[]}
 */
function heuristicClasses(tool) {
  const t = tool.toLowerCase();
  if (
    /\.(get|list|search|query|describe|stats|count|sample|export|read|metadata|scroll|fetch)\b/.test(
      t,
    ) ||
    t.endsWith(".list") ||
    t.includes(".rows.") ||
    t.includes(".columns.") ||
    t.includes(".schema.") ||
    t.includes(".project.") ||
    t.includes(".viewer.") ||
    t.includes(".version") ||
    t.includes("package.get")
  ) {
    return [MUTATION_CLASS.READ_ONLY];
  }
  if (/\.delete\b|\.destroy\b|purge/.test(t)) {
    return [MUTATION_CLASS.DESTRUCTIVE];
  }
  if (
    /message\.send|\.send\b|whatsapp\.|teams\.(channel|chat)\.message\.send/.test(
      t,
    )
  ) {
    return [
      MUTATION_CLASS.IRREVERSIBLE_MUTATION,
      MUTATION_CLASS.EXTERNAL_COMMUNICATION,
    ];
  }
  if (
    /charge\.|payment|invoice|refund|subscription|customer\.|order\.|deal\.|balance\.|financial/.test(
      t,
    )
  ) {
    if (/\.(get|list|search|query|describe)\b/.test(t)) {
      return [MUTATION_CLASS.READ_ONLY, MUTATION_CLASS.FINANCIALLY_SENSITIVE];
    }
    return [
      MUTATION_CLASS.REVERSIBLE_MUTATION,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ];
  }
  if (
    /\.(create|append|upload|upsert|replace|set|update|write|comment|note|transition|status\.)/.test(
      t,
    )
  ) {
    if (/comment|note|message|send|status\.set|status\.update/.test(t)) {
      return [
        MUTATION_CLASS.REVERSIBLE_MUTATION,
        MUTATION_CLASS.EXTERNAL_COMMUNICATION,
      ];
    }
    return [MUTATION_CLASS.REVERSIBLE_MUTATION];
  }
  return [MUTATION_CLASS.READ_ONLY];
}

/**
 * @param {readonly string[]} classes
 */
function formatClasses(classes) {
  return `[${classes.map((c) => JSON.stringify(c)).join(", ")}]`;
}

const connectors = await loadConnectorPackages(ROOT);
/** @type {Record<string, Record<string, readonly string[]>>} */
const inventory = {};

for (const connector of connectors) {
  const declared = await loadDeclaredToolsFromPackage(
    ROOT,
    connector.directory,
  );
  if (!declared?.length) {
    continue;
  }
  const manual = MANUAL_OVERRIDES[connector.directory] ?? {};
  inventory[connector.directory] = {};
  for (const tool of declared) {
    inventory[connector.directory][tool] =
      manual[tool] ?? heuristicClasses(tool);
  }
}

const lines = [];
lines.push(`/** @type {Record<string, Record<string, readonly string[]>>} */`);
lines.push("export const MUTATION_INVENTORY = Object.freeze({");
const dirs = Object.keys(inventory).sort((a, b) => a.localeCompare(b));
for (const dir of dirs) {
  lines.push(`  ${JSON.stringify(dir)}: {`);
  const tools = Object.keys(inventory[dir]).sort((a, b) => a.localeCompare(b));
  for (const tool of tools) {
    lines.push(
      `    ${JSON.stringify(tool)}: ${formatClasses(inventory[dir][tool])},`,
    );
  }
  lines.push("  },");
}
lines.push("});");

const target = path.join(
  ROOT,
  "scripts/live-provider/mutation-inventory.generated.mjs",
);
await fs.writeFile(
  target,
  `/** AUTO-GENERATED — run build-mutation-inventory.mjs to refresh. */\n\n${lines.join("\n")}\n`,
  "utf8",
);
console.log(`Wrote ${target} (${dirs.length} connectors)`);
