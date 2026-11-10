/**
 * CI shard B: packaged MCP acceptance for connectors not run as individual CI steps in verify.
 * Runs sequentially to limit runner memory and install churn.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const SHARD_B_SCRIPTS = [
  "test:package-acceptance:gmail",
  "test:package-acceptance:google-calendar",
  "test:package-acceptance:notion",
  "test:package-acceptance:linear",
  "test:package-acceptance:jira",
  "test:package-acceptance:confluence",
  "test:package-acceptance:outlook",
  "test:package-acceptance:onedrive",
  "test:package-acceptance:teams",
  "test:package-acceptance:exa",
  "test:package-acceptance:tavily",
  "test:package-acceptance:firecrawl",
  "test:package-acceptance:qdrant",
  "test:package-acceptance:pinecone",
  "test:package-acceptance:mixpanel",
  "test:package-acceptance:amplitude",
  "test:package-acceptance:woocommerce",
  "test:package-acceptance:bigcommerce",
];

function runPnpm(scriptName) {
  const result = spawnSync("pnpm", [scriptName], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.stderr.write(
      `[ci-package-acceptance-shard-b] ${scriptName} failed (${result.status}):\n${result.stderr ?? ""}\n${result.stdout ?? ""}\n`,
    );
    process.exit(result.status ?? 1);
  }
  process.stdout.write(result.stdout ?? "");
}

for (const script of SHARD_B_SCRIPTS) {
  process.stderr.write(`[ci-package-acceptance-shard-b] running ${script}\n`);
  runPnpm(script);
}

console.log("ci-package-acceptance-shard-b: ok");
