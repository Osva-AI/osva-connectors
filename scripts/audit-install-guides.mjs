/**
 * One-off audit helper (also imported by install-guide-consistency tests).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CATALOG_PATH = path.join(ROOT, "docs", "connector-catalog.json");

const SOURCE_ONLY_RE =
  /source-only|not yet published on npm|not published yet|not published until bootstrap/i;

/** @typedef {{ connectorId: string, kind: string, detail?: string }} AuditIssue */

/** @returns {AuditIssue[]} */
export function auditInstallGuides(
  catalogRaw = fs.readFileSync(CATALOG_PATH, "utf8"),
) {
  const catalog = JSON.parse(catalogRaw);
  /** @type {AuditIssue[]} */
  const issues = [];

  for (const c of catalog.connectors) {
    if (!c.installGuide) {
      issues.push({
        connectorId: c.connectorId,
        kind: "missing_install_guide",
      });
      continue;
    }
    const absGuide = path.join(ROOT, c.installGuide);
    if (!fs.existsSync(absGuide)) {
      issues.push({
        connectorId: c.connectorId,
        kind: "install_guide_file_missing",
        detail: c.installGuide,
      });
      continue;
    }
    const text = fs.readFileSync(absGuide, "utf8");
    const ver = c.publishedVersion;
    const pkg = c.npmPackage;

    if (!text.includes(pkg)) {
      issues.push({
        connectorId: c.connectorId,
        kind: "missing_npm_package_reference",
        detail: pkg,
      });
    }

    const versionPinRe = new RegExp(
      `${pkg.replace(/\//g, "\\/")}@(\\d+\\.\\d+\\.\\d+)`,
      "g",
    );
    const pins = new Set();
    for (const match of text.matchAll(versionPinRe)) {
      pins.add(match[1]);
    }
    if (pins.size > 0 && !pins.has(ver)) {
      issues.push({
        connectorId: c.connectorId,
        kind: "version_pin_mismatch",
        detail: `expected ${ver}, found ${[...pins].join(", ")}`,
      });
    }
    if (pins.size === 0 && text.includes(pkg)) {
      issues.push({
        connectorId: c.connectorId,
        kind: "missing_explicit_version_pin",
        detail: ver,
      });
    }

    if (SOURCE_ONLY_RE.test(text)) {
      issues.push({
        connectorId: c.connectorId,
        kind: "obsolete_source_only_language",
      });
    }

    const bin = c.connectorKey;
    const hasExecutable =
      text.includes(`"${bin}"`) ||
      text.includes(`\`${bin}\``) ||
      text.includes(` ${bin}`) ||
      text.includes(`\n${bin}`);
    const hasNpxArgs = new RegExp(
      `"args":\\s*\\[[^\\]]*${pkg.replace(/\//g, "\\/")}`,
    ).test(text);
    if (!hasExecutable && !hasNpxArgs) {
      issues.push({
        connectorId: c.connectorId,
        kind: "missing_executable_or_npx_args",
        detail: bin,
      });
    }

    if (!/Node\.js\s+24/i.test(text)) {
      issues.push({
        connectorId: c.connectorId,
        kind: "missing_node_24_requirement",
      });
    }

    const dir = path.dirname(c.installGuide);
    for (const match of text.matchAll(/\]\((\.\/[^)]+)\)/g)) {
      const target = path.normalize(path.join(ROOT, dir, match[1]));
      if (!fs.existsSync(target)) {
        issues.push({
          connectorId: c.connectorId,
          kind: "broken_local_link",
          detail: match[1],
        });
      }
    }
  }

  return issues;
}

if (process.argv[1]?.endsWith("audit-install-guides.mjs")) {
  const issues = auditInstallGuides();
  console.log(JSON.stringify(issues, null, 2));
  console.log(`total issues: ${issues.length}`);
  process.exit(issues.length > 0 ? 1 : 0);
}
