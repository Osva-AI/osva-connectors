#!/usr/bin/env node
/**
 * B5.6B: Lightweight registry metadata audit (no npm install).
 * Compares workspace versions to npm `dist-tags.latest` and version existence.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadConnectorPackages } from "./load-connector-packages.mjs";
import {
  B5_WAVE_DIRECTORIES,
  defaultRunNpm,
} from "./published-package-acceptance-core.mjs";

const ROOT = path.dirname(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
);

function npmViewJson(spec, fields) {
  const args = ["view", spec, ...fields, "--json"];
  const result = defaultRunNpm(args, process.cwd());
  if ((result.status ?? 1) !== 0) {
    return {
      ok: false,
      stderr: `${result.stderr ?? ""}${result.stdout ?? ""}`.trim(),
    };
  }
  try {
    return { ok: true, data: JSON.parse(result.stdout ?? "{}") };
  } catch {
    return { ok: false, stderr: "invalid JSON from npm view" };
  }
}

function provenanceForVersion(versionJson) {
  const signatures = versionJson?.dist?.signatures;
  if (Array.isArray(signatures) && signatures.length > 0) {
    return "signatures-present";
  }
  return "no-signatures";
}

async function main() {
  const connectors = await loadConnectorPackages(ROOT);
  const waveSet = new Set(B5_WAVE_DIRECTORIES);
  const outArg = process.argv.indexOf("--json-out");
  const jsonOut =
    outArg >= 0 ? path.resolve(process.argv[outArg + 1] ?? "") : null;

  const rows = [];
  let ok = 0;
  let mismatch = 0;
  let blocked = 0;

  for (const pkg of connectors) {
    const wave = waveSet.has(pkg.directory);
    const meta = npmViewJson(pkg.name, ["version", "dist-tags"]);
    if (!meta.ok) {
      blocked += 1;
      rows.push({
        name: pkg.name,
        directory: pkg.directory,
        workspaceVersion: pkg.version,
        status: "BLOCKED",
        wave,
        error: meta.stderr,
      });
      continue;
    }

    const latest =
      meta.data?.["dist-tags"]?.latest ??
      (typeof meta.data === "string" ? meta.data : meta.data?.version);
    const versionExists = npmViewJson(`${pkg.name}@${pkg.version}`, [
      "version",
    ]);
    const versionMeta = versionExists.ok
      ? npmViewJson(`${pkg.name}@${pkg.version}`, [])
      : { ok: false };

    let provenance = "unknown";
    if (versionMeta.ok && typeof versionMeta.data === "object") {
      provenance = provenanceForVersion(versionMeta.data);
    }

    const latestMatch = latest === pkg.version;
    const versionResolvable = versionExists.ok;
    const status =
      latestMatch && versionResolvable
        ? "OK"
        : !versionResolvable
          ? "VERSION_NOT_ON_REGISTRY"
          : "LATEST_TAG_MISMATCH";

    if (status === "OK") {
      ok += 1;
    } else if (status === "BLOCKED") {
      blocked += 1;
    } else {
      mismatch += 1;
    }

    rows.push({
      name: pkg.name,
      directory: pkg.directory,
      workspaceVersion: pkg.version,
      npmLatest: latest,
      wave,
      provenance,
      versionResolvable,
      latestMatchesWorkspace: latestMatch,
      status,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    registry: "https://registry.npmjs.org",
    summary: {
      total: connectors.length,
      ok,
      mismatch,
      blocked,
      wavePackages: rows.filter((r) => r.wave).length,
      legacyPackages: rows.filter((r) => !r.wave).length,
    },
    packages: rows,
  };

  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (jsonOut) {
    await fs.mkdir(path.dirname(jsonOut), { recursive: true });
    await fs.writeFile(jsonOut, text, "utf8");
    console.error(`Wrote ${jsonOut}`);
  }
  console.log(text);
  if (mismatch > 0 || blocked > 0) {
    process.exit(1);
  }
}

const entry = fileURLToPath(import.meta.url);
const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invoked === entry) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
