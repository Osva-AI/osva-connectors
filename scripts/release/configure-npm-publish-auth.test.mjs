import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  applyNpmPublishAuth,
  configureNpmPublishAuthFromEnv,
  npmPublishChildEnv,
  stripRegistryAuth,
} from "./configure-npm-publish-auth.mjs";
import { buildNpmPublishResult } from "./run-npm-publish.mjs";

const SETUP_NODE_NPMRC = [
  "registry=https://registry.npmjs.org/",
  "//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}",
  "always-auth=true",
  "",
].join("\n");

test("OIDC mode strips empty registry auth-token placeholders", () => {
  const result = applyNpmPublishAuth({
    npmrcContents: SETUP_NODE_NPMRC,
    useNpmToken: false,
    hasNpmToken: false,
  });
  assert.equal(result.setNodeAuthToken, false);
  assert.doesNotMatch(result.npmrcContents, /_authToken=/);
  assert.doesNotMatch(result.npmrcContents, /always-auth=true/);
});

test("OIDC mode ignores a present NPM_TOKEN unless explicitly requested", () => {
  const result = applyNpmPublishAuth({
    npmrcContents: SETUP_NODE_NPMRC,
    useNpmToken: false,
    hasNpmToken: true,
  });
  assert.equal(result.setNodeAuthToken, false);
  assert.match(
    result.logLines.join("\n"),
    /ignored because use_npm_token is not true/,
  );
});

test("token fallback requires an explicit flag and a non-empty secret", () => {
  assert.throws(
    () =>
      applyNpmPublishAuth({
        npmrcContents: SETUP_NODE_NPMRC,
        useNpmToken: true,
        hasNpmToken: false,
      }),
    /requires a non-empty NPM_TOKEN/,
  );
});

test("token fallback keeps the setup-node auth-token mapping", () => {
  const result = applyNpmPublishAuth({
    npmrcContents: SETUP_NODE_NPMRC,
    useNpmToken: true,
    hasNpmToken: true,
  });
  assert.equal(result.setNodeAuthToken, true);
  assert.match(result.npmrcContents, /_authToken=\$\{NODE_AUTH_TOKEN\}/);
});

test("OIDC child env unsets empty NODE_AUTH_TOKEN inheritance", () => {
  const env = npmPublishChildEnv(
    {
      NODE_AUTH_TOKEN: "",
      NPM_TOKEN: "",
      PATH: "/usr/bin",
    },
    { setNodeAuthToken: false, npmToken: "" },
  );
  assert.equal("NODE_AUTH_TOKEN" in env, false);
  assert.equal("NPM_TOKEN" in env, false);
  assert.equal(env.PATH, "/usr/bin");
});

test("token child env sets NODE_AUTH_TOKEN without logging it", () => {
  const built = buildNpmPublishResult({
    npmrcContents: SETUP_NODE_NPMRC,
    useNpmToken: true,
    npmToken: "npm_testtoken_not_for_production",
    baseEnv: { PATH: "/usr/bin" },
  });
  assert.equal(built.env.NODE_AUTH_TOKEN, "npm_testtoken_not_for_production");
  assert.deepEqual(built.args, [
    "publish",
    "--provenance",
    "--access",
    "public",
  ]);
  assert.equal(built.auth.logLines.join("\n").includes("npm_testtoken"), false);
});

test("configureNpmPublishAuthFromEnv writes a stripped npmrc for OIDC", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "osva-oidc-"));
  const npmrcPath = path.join(dir, ".npmrc");
  await fs.writeFile(npmrcPath, SETUP_NODE_NPMRC, "utf8");
  const result = await configureNpmPublishAuthFromEnv(
    {
      OSVA_NPMRC_PATH: npmrcPath,
      USE_NPM_TOKEN: "false",
      NPM_TOKEN: "",
    },
    { write: true },
  );
  const written = await fs.readFile(npmrcPath, "utf8");
  assert.equal(result.setNodeAuthToken, false);
  assert.equal(written, stripRegistryAuth(SETUP_NODE_NPMRC));
});
