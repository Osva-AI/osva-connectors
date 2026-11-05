/**
 * Run vitest across all connector packages with bounded concurrency to avoid
 * fork-pool ENOMEM when many packages test in parallel (e.g. on Windows).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONNECTOR_PACKAGES } from "./connector-packages.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const concurrency = (() => {
  const raw = process.env.OSVA_CONNECTOR_TEST_CONCURRENCY;
  if (raw === undefined || raw === "") {
    return 1;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    console.error(
      `Invalid OSVA_CONNECTOR_TEST_CONCURRENCY: ${raw} (expected positive integer)`,
    );
    process.exit(1);
  }
  return parsed;
})();

function runPackageTest(packageName) {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["--filter", packageName, "test"], {
      cwd: ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${packageName} test failed (code=${code ?? "null"}, signal=${signal ?? "null"})`,
        ),
      );
    });
  });
}

async function main() {
  console.log(
    `run-bounded-connector-tests: ${CONNECTOR_PACKAGES.length} packages, concurrency=${concurrency}`,
  );
  let nextIndex = 0;
  let failed = false;

  async function worker() {
    while (nextIndex < CONNECTOR_PACKAGES.length) {
      const index = nextIndex;
      nextIndex += 1;
      const packageName = CONNECTOR_PACKAGES[index];
      try {
        await runPackageTest(packageName);
      } catch (error) {
        failed = true;
        console.error(error instanceof Error ? error.message : String(error));
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  if (failed) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
