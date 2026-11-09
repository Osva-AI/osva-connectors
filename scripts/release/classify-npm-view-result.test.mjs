import assert from "node:assert/strict";
import test from "node:test";

import {
  NPM_VIEW_KIND,
  classifyNpmViewResult,
  redactSecrets,
} from "./classify-npm-view-result.mjs";

test("published version is detected from a successful npm view", () => {
  const result = classifyNpmViewResult({
    status: 0,
    stdout: "0.1.0\n",
    stderr: "",
    expectedVersion: "0.1.0",
  });
  assert.equal(result.kind, NPM_VIEW_KIND.published);
});

test("E404 is unpublished and safe to upload", () => {
  const result = classifyNpmViewResult({
    status: 1,
    stdout: "",
    stderr:
      "npm error code E404\nnpm error 404 Not Found - GET https://registry.npmjs.org/@osva-ai%2fconnector-gmail",
    expectedVersion: "0.1.0",
  });
  assert.equal(result.kind, NPM_VIEW_KIND.unpublished);
});

test("E401 is an auth failure, not unpublished", () => {
  const result = classifyNpmViewResult({
    status: 1,
    stdout: "",
    stderr:
      "npm error code E401\nnpm error 401 Unauthorized - GET https://registry.npmjs.org/@osva-ai%2fconnector-gmail",
    expectedVersion: "0.1.0",
  });
  assert.equal(result.kind, NPM_VIEW_KIND.authFailure);
});

test("E403 is an auth failure, not unpublished", () => {
  const result = classifyNpmViewResult({
    status: 1,
    stdout: "",
    stderr: "npm error code E403\nnpm error 403 Forbidden",
    expectedVersion: "0.1.0",
  });
  assert.equal(result.kind, NPM_VIEW_KIND.authFailure);
});

test("ENOTFOUND is a network failure", () => {
  const result = classifyNpmViewResult({
    status: 1,
    stdout: "",
    stderr:
      "npm error code ENOTFOUND\nnpm error network request to https://registry.npmjs.org/ failed",
    expectedVersion: "0.1.0",
  });
  assert.equal(result.kind, NPM_VIEW_KIND.networkFailure);
});

test("E503 is a registry failure", () => {
  const result = classifyNpmViewResult({
    status: 1,
    stdout: "",
    stderr: "npm error code E503\nnpm error 503 Service Unavailable",
    expectedVersion: "0.1.0",
  });
  assert.equal(result.kind, NPM_VIEW_KIND.registryFailure);
});

test("unknown nonzero npm view errors fail closed", () => {
  const result = classifyNpmViewResult({
    status: 1,
    stdout: "",
    stderr: "npm error unexpected local disk failure",
    expectedVersion: "0.1.0",
  });
  assert.equal(result.kind, NPM_VIEW_KIND.unknown);
});

test("success with the wrong version fails closed", () => {
  const result = classifyNpmViewResult({
    status: 0,
    stdout: "0.2.0\n",
    stderr: "",
    expectedVersion: "0.1.0",
  });
  assert.equal(result.kind, NPM_VIEW_KIND.unknown);
});

test("redactSecrets strips auth tokens from logs", () => {
  const redacted = redactSecrets(
    "//registry.npmjs.org/:_authToken=npm_supersecretvalue1234567890",
  );
  assert.match(redacted, /\[redacted\]/);
  assert.doesNotMatch(redacted, /supersecret/);
});
