import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyNpmPublishDryRunForAcceptance,
  NPM_BIN_STRIP_PATTERN_GITHUB,
} from "./package-acceptance-npm-dry-run.mjs";

test("acceptance dry-run treats registry duplicate version as non-fatal", () => {
  const outcome = classifyNpmPublishDryRunForAcceptance(
    {
      status: 1,
      stderr:
        "npm error You cannot publish over the previously published versions: 0.3.0.",
    },
    NPM_BIN_STRIP_PATTERN_GITHUB,
  );
  assert.equal(outcome, "version_already_published");
});

test("acceptance dry-run still fails when npm would strip bin", () => {
  assert.throws(
    () =>
      classifyNpmPublishDryRunForAcceptance(
        {
          status: 0,
          stderr: "npm warn bin[osva-connector-github] was invalid and removed",
        },
        NPM_BIN_STRIP_PATTERN_GITHUB,
      ),
    /would strip bin/,
  );
});

test("acceptance dry-run passes on clean success", () => {
  const outcome = classifyNpmPublishDryRunForAcceptance(
    {
      status: 0,
      stdout: "npm notice package: @osva-ai/connector-github@0.3.0",
    },
    NPM_BIN_STRIP_PATTERN_GITHUB,
  );
  assert.equal(outcome, "ok");
});
