import assert from "node:assert/strict";
import test from "node:test";

import { NPM_VIEW_KIND } from "./classify-npm-view-result.mjs";
import { assertVersionUnpublished } from "./check-npm-version-unpublished.mjs";

test("CLI helper allows upload only for unpublished versions", () => {
  const result = assertVersionUnpublished({
    packageName: "@osva-ai/connector-gmail",
    version: "0.1.0",
    status: 1,
    stdout: "",
    stderr:
      "npm error code E404\nnpm error 404 Not Found - GET https://registry.npmjs.org/@osva-ai%2fconnector-gmail",
  });
  assert.equal(result.kind, NPM_VIEW_KIND.unpublished);
});

test("CLI helper refuses upload when the version already exists", () => {
  assert.throws(
    () =>
      assertVersionUnpublished({
        packageName: "@osva-ai/connector-gmail",
        version: "0.1.0",
        status: 0,
        stdout: "0.1.0\n",
        stderr: "",
      }),
    /already published/,
  );
});

test("CLI helper refuses upload on auth failures instead of treating them as unpublished", () => {
  assert.throws(
    () =>
      assertVersionUnpublished({
        packageName: "@osva-ai/connector-gmail",
        version: "0.1.0",
        status: 1,
        stdout: "",
        stderr: "npm error code E401\nnpm error 401 Unauthorized",
      }),
    (error) => {
      assert.equal(error.kind, NPM_VIEW_KIND.authFailure);
      return /authentication or authorization failed/.test(error.message);
    },
  );
});
