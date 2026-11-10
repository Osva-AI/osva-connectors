/**
 * Resolves npm .bin shims for packaged MCP acceptance smoke tests.
 * On Windows, .cmd shims require shell: true (spawn cannot execute them directly).
 */
import path from "node:path";

/**
 * @param {string} installDir Acceptance install root (cwd with node_modules)
 * @param {string} binName e.g. "osva-connector-github"
 */
export function resolvePackageAcceptanceBinShim(installDir, binName) {
  const binDir = path.join(installDir, "node_modules", ".bin");
  if (process.platform === "win32") {
    return {
      command: path.join(binDir, `${binName}.cmd`),
      args: [],
      shell: true,
    };
  }
  return {
    command: path.join(binDir, binName),
    args: [],
    shell: false,
  };
}
