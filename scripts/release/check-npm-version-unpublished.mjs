import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  NPM_VIEW_KIND,
  classifyNpmViewResult,
} from "./classify-npm-view-result.mjs";

export function runNpmViewVersion({
  packageName,
  version,
  command = process.env.OSVA_NPM_VIEW_COMMAND ?? "npm",
  args,
  env = process.env,
}) {
  const viewArgs = args ?? ["view", `${packageName}@${version}`, "version"];
  return spawnSync(command, viewArgs, {
    encoding: "utf8",
    shell: false,
    env,
  });
}

export function assertVersionUnpublished({
  packageName,
  version,
  status,
  stdout,
  stderr,
}) {
  const classification = classifyNpmViewResult({
    status,
    stdout,
    stderr,
    expectedVersion: version,
  });

  if (classification.kind === NPM_VIEW_KIND.unpublished) {
    return classification;
  }

  const error = new Error(classification.message);
  error.kind = classification.kind;
  error.packageName = packageName;
  throw error;
}

function main() {
  const packageName = process.argv[2];
  const version = process.argv[3];
  if (!packageName || !version) {
    console.error(
      "Usage: node scripts/release/check-npm-version-unpublished.mjs <package> <version>",
    );
    process.exit(2);
  }

  const result = runNpmViewVersion({ packageName, version });
  try {
    const classification = assertVersionUnpublished({
      packageName,
      version,
      status: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    });
    console.log(classification.message);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
