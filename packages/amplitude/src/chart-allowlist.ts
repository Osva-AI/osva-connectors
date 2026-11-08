import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export interface ChartAllowlist {
  readonly allowedChartIds: ReadonlySet<string>;
}

export function createChartAllowlist(
  chartIds: readonly string[] | undefined,
): ChartAllowlist | undefined {
  if (chartIds === undefined) {
    return undefined;
  }
  return { allowedChartIds: new Set(chartIds) };
}

export function assertChartAllowed(
  allowlist: ChartAllowlist | undefined,
  chartId: string,
): void {
  if (allowlist === undefined) {
    return;
  }
  if (allowlist.allowedChartIds.size === 0) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "Chart allowlist is explicitly empty; no charts are permitted.",
    );
  }
  if (!allowlist.allowedChartIds.has(chartId)) {
    throw new ConnectorSdkError(
      "FORBIDDEN",
      "The requested chart is not in the configured allowlist.",
    );
  }
}
