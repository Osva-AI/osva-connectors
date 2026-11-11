import assert from "node:assert/strict";
import test from "node:test";

import { CHECK, STATUS } from "./published-package-acceptance-core.mjs";
import { summarizePublishedReport } from "./summarize-published-verification.mjs";

test("summarize handles empty package list", () => {
  const out = summarizePublishedReport({ packages: [] });
  assert.equal(out.packageCount, 0);
  assert.equal(out.byOverall.PASSED ?? 0, 0);
  assert.equal(out.failures.length, 0);
});

test("summarize counts failed packages and skipped checks", () => {
  const out = summarizePublishedReport({
    summary: { checksSkipped: 2 },
    packages: [
      {
        name: "@osva-ai/connector-x",
        version: "0.1.0",
        overall: STATUS.FAILED,
        wave: false,
        checks: [
          {
            id: CHECK.REGISTRY_VERSION,
            status: STATUS.FAILED,
            evidence: "missing",
          },
          { id: CHECK.CLI_PROBE, status: STATUS.SKIPPED, evidence: "optional" },
        ],
      },
    ],
  });
  assert.equal(out.byOverall.FAILED, 1);
  assert.equal(out.failures.length, 1);
  assert.equal(out.checkTotals.cli_probe.SKIPPED, 1);
  assert.equal(out.checksSkipped, 2);
});

test("summarize tolerates missing summary and malformed status values", () => {
  const out = summarizePublishedReport({
    packages: [
      {
        name: "@osva-ai/connector-y",
        version: "1.0.0",
        checks: [
          { id: "unknown_check", status: 42 },
          { id: CHECK.PROVENANCE, status: STATUS.PASSED, evidence: "ok" },
        ],
      },
    ],
  });
  assert.equal(out.byOverall.UNKNOWN, 1);
  assert.equal(out.checkTotals.unknown_check.UNKNOWN, 1);
  assert.equal(out.checksSkipped, 0);
});

test("invalid JSON is rejected by parse (smoke)", () => {
  assert.throws(() => JSON.parse("{not-json"), SyntaxError);
});
