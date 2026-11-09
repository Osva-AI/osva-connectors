import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  applyNpmPublishAuth,
  configureNpmPublishAuthFromEnv,
  hasNonEmptyToken,
  isExplicitTrue,
  npmPublishChildEnv,
} from "./configure-npm-publish-auth.mjs";

export function buildNpmPublishResult({
  npmrcContents,
  useNpmToken,
  npmToken,
  baseEnv,
}) {
  const auth = applyNpmPublishAuth({
    npmrcContents,
    useNpmToken,
    hasNpmToken: hasNonEmptyToken(npmToken),
  });
  return {
    auth,
    env: npmPublishChildEnv(baseEnv, {
      setNodeAuthToken: auth.setNodeAuthToken,
      npmToken,
    }),
    args: ["publish", "--provenance", "--access", "public"],
  };
}

async function main() {
  const useNpmToken = isExplicitTrue(process.env.USE_NPM_TOKEN);
  const npmToken = process.env.NPM_TOKEN ?? "";
  const auth = await configureNpmPublishAuthFromEnv(process.env, {
    write: true,
  });
  for (const line of auth.logLines) {
    console.log(line);
  }

  const env = npmPublishChildEnv(process.env, {
    setNodeAuthToken: auth.setNodeAuthToken,
    npmToken,
  });
  if (useNpmToken !== auth.setNodeAuthToken) {
    throw new Error("Internal auth mode mismatch before npm publish.");
  }

  const result = spawnSync(
    "npm",
    ["publish", "--provenance", "--access", "public"],
    {
      encoding: "utf8",
      shell: false,
      env,
      stdio: "inherit",
    },
  );
  process.exit(result.status === 0 ? 0 : (result.status ?? 1));
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
