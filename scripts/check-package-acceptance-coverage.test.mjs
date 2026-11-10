import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CHECK_SCRIPT = path.join(
  ROOT,
  "scripts",
  "check-package-acceptance-coverage.mjs",
);

test("check-package-acceptance-coverage passes for current workspace", () => {
  const result = spawnSync(process.execPath, [CHECK_SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    0,
    `check-package-acceptance-coverage failed:\n${result.stderr}\n${result.stdout}`,
  );
});
