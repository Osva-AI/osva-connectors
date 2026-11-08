import { assertStructuredOutputWithinBudget } from "./output-budget.js";

export interface NormalizeMixpanelResponseOptions {
  readonly projectId: number;
  readonly raw: unknown;
}

export function normalizeMixpanelResponse(
  options: NormalizeMixpanelResponseOptions,
): { projectId: number; data: unknown } {
  const payload = {
    projectId: options.projectId,
    data: options.raw,
  };
  assertStructuredOutputWithinBudget(payload);
  return payload;
}
