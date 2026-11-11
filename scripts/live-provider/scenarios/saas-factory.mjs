import { getSaasSpec } from "./saas-specs.mjs";
import { runSaasScenarios } from "./saas-runner.mjs";

/**
 * @param {string} directory
 */
export function createSaasScenarioRunner(directory) {
  const spec = getSaasSpec(directory);
  return async (ctx) => runSaasScenarios(ctx, spec);
}
