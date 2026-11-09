/**
 * Prepare userconfig npmrc + NODE_AUTH_TOKEN for GitHub Actions OIDC
 * trusted publishing. Token fallback is opt-in only (use_npm_token=true).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const REGISTRY_AUTH_LINE = /^\/\/registry\.npmjs\.org\/:_authToken=/;
const ALWAYS_AUTH_LINE = /^always-auth=true$/;

export function isExplicitTrue(value) {
  if (value === true) {
    return true;
  }
  if (typeof value !== "string") {
    return false;
  }
  return ["true", "1", "yes"].includes(value.trim().toLowerCase());
}

export function hasNonEmptyToken(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasRegistryAuthLine(contents) {
  return String(contents ?? "")
    .split(/\r?\n/)
    .some((line) => REGISTRY_AUTH_LINE.test(line));
}

export function stripRegistryAuth(contents) {
  return String(contents ?? "")
    .split(/\r?\n/)
    .filter((line) => !REGISTRY_AUTH_LINE.test(line))
    .filter((line) => !ALWAYS_AUTH_LINE.test(line))
    .join("\n");
}

export function applyNpmPublishAuth({
  npmrcContents,
  useNpmToken,
  hasNpmToken,
}) {
  const logLines = [];

  if (useNpmToken) {
    if (!hasNpmToken) {
      throw new Error(
        "use_npm_token=true requires a non-empty NPM_TOKEN secret; refusing to fall back to OIDC or an empty NODE_AUTH_TOKEN.",
      );
    }
    logLines.push("Publish authentication: explicit NPM_TOKEN fallback");
    if (!hasRegistryAuthLine(npmrcContents)) {
      throw new Error(
        "Expected setup-node to create userconfig npmrc with //registry.npmjs.org/:_authToken for token fallback.",
      );
    }
    return {
      npmrcContents,
      setNodeAuthToken: true,
      logLines,
    };
  }

  logLines.push("Publish authentication: OIDC trusted publishing");
  if (hasNpmToken) {
    logLines.push(
      "NPM_TOKEN is present but ignored because use_npm_token is not true.",
    );
  }

  const next = stripRegistryAuth(npmrcContents);
  if (hasRegistryAuthLine(next)) {
    throw new Error(
      "Registry _authToken entry still present; OIDC trusted publishing would be blocked.",
    );
  }
  logLines.push(
    "OIDC authentication path validated (no registry _authToken placeholder).",
  );
  return {
    npmrcContents: next,
    setNodeAuthToken: false,
    logLines,
  };
}

export function npmPublishChildEnv(baseEnv, { setNodeAuthToken, npmToken }) {
  const env = { ...baseEnv };
  if (setNodeAuthToken) {
    env.NODE_AUTH_TOKEN = npmToken;
    return env;
  }
  delete env.NODE_AUTH_TOKEN;
  delete env.NPM_TOKEN;
  return env;
}

export async function configureNpmPublishAuthFromEnv(
  env = process.env,
  { write = true } = {},
) {
  const useNpmToken = isExplicitTrue(env.USE_NPM_TOKEN);
  const npmToken = env.NPM_TOKEN ?? "";
  let npmrcPath = env.OSVA_NPMRC_PATH;
  if (!npmrcPath) {
    const resolved = spawnSync("npm", ["config", "get", "userconfig"], {
      encoding: "utf8",
      shell: false,
    });
    npmrcPath = (resolved.stdout ?? "").trim();
  }
  if (!npmrcPath) {
    throw new Error("Unable to resolve npm userconfig path.");
  }

  let npmrcContents = "";
  try {
    npmrcContents = await fs.readFile(npmrcPath, "utf8");
  } catch (error) {
    if (useNpmToken) {
      throw new Error(
        "Expected setup-node to create userconfig npmrc for token fallback.",
      );
    }
    if (error && error.code !== "ENOENT") {
      throw error;
    }
  }

  const result = applyNpmPublishAuth({
    npmrcContents,
    useNpmToken,
    hasNpmToken: hasNonEmptyToken(npmToken),
  });

  if (write) {
    await fs.mkdir(path.dirname(npmrcPath), { recursive: true });
    await fs.writeFile(npmrcPath, result.npmrcContents, "utf8");
  }

  if (env.OSVA_NPM_PUBLISH_AUTH_MODE_PATH) {
    await fs.writeFile(
      env.OSVA_NPM_PUBLISH_AUTH_MODE_PATH,
      result.setNodeAuthToken ? "token\n" : "oidc\n",
      "utf8",
    );
  }

  return result;
}

async function main() {
  const result = await configureNpmPublishAuthFromEnv(process.env, {
    write: !process.argv.includes("--dry-print"),
  });
  for (const line of result.logLines) {
    console.log(line);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
