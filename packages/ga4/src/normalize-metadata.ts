import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  assertStructuredOutputWithinBudget,
  normalizeEssentialProviderString,
  normalizeTruncatableProviderString,
  OUTPUT_MAX_METADATA_NAME_LENGTH,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  packListWithinOutputBudget,
} from "./output-budget.js";

const UNEXPECTED = "Google Analytics returned an unexpected metadata payload.";

export interface MetadataEntry {
  readonly apiName: string;
  readonly uiName: string;
  readonly description: string;
  readonly customDefinition?: boolean;
  readonly category?: string;
}

function mapMetadataField(entry: unknown): MetadataEntry | undefined {
  if (entry === null || typeof entry !== "object") {
    return undefined;
  }
  const record = entry as Record<string, unknown>;
  const apiName = normalizeEssentialProviderString(
    record.apiName,
    OUTPUT_MAX_METADATA_NAME_LENGTH,
    UNEXPECTED,
  );
  const uiName = normalizeTruncatableProviderString(
    record.uiName ?? apiName,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  ).value;
  const description = normalizeTruncatableProviderString(
    record.description ?? "",
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  ).value;
  return {
    apiName,
    uiName,
    description,
    ...(typeof record.customDefinition === "boolean"
      ? { customDefinition: record.customDefinition }
      : {}),
    ...(typeof record.category === "string" && record.category.length > 0
      ? {
          category: normalizeTruncatableProviderString(record.category, 128)
            .value,
        }
      : {}),
  };
}

export function filterMetadataEntries(
  entries: readonly MetadataEntry[],
  search: string | undefined,
): MetadataEntry[] {
  if (search === undefined || search.trim().length === 0) {
    return [...entries];
  }
  const needle = search.trim().toLowerCase();
  return entries.filter(
    (entry) =>
      entry.apiName.toLowerCase().includes(needle) ||
      entry.uiName.toLowerCase().includes(needle) ||
      entry.description.toLowerCase().includes(needle),
  );
}

export function paginateMetadataEntries(
  entries: readonly MetadataEntry[],
  limit: number,
  offset: number,
): {
  items: MetadataEntry[];
  totalMatched: number;
  nextOffset?: number;
} {
  const totalMatched = entries.length;
  const slice = entries.slice(offset, offset + limit);
  const nextOffset =
    offset + slice.length < totalMatched ? offset + slice.length : undefined;
  return {
    items: slice,
    totalMatched,
    ...(nextOffset !== undefined ? { nextOffset } : {}),
  };
}

export function mapMetadataResponse(params: {
  raw: unknown;
  type: "dimensions" | "metrics" | "all";
  search?: string;
  limit: number;
  offset: number;
}): {
  dimensions: MetadataEntry[];
  metrics: MetadataEntry[];
  totalMatched: number;
  nextOffset?: number;
  localPagination: true;
} {
  if (params.raw === null || typeof params.raw !== "object") {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }
  const envelope = params.raw as {
    dimensions?: unknown;
    metrics?: unknown;
  };

  const dimensionEntries: MetadataEntry[] = [];
  if (params.type === "dimensions" || params.type === "all") {
    if (!Array.isArray(envelope.dimensions)) {
      throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
    }
    for (const entry of envelope.dimensions) {
      const mapped = mapMetadataField(entry);
      if (mapped !== undefined) {
        dimensionEntries.push(mapped);
      }
    }
  }

  const metricEntries: MetadataEntry[] = [];
  if (params.type === "metrics" || params.type === "all") {
    if (!Array.isArray(envelope.metrics)) {
      throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
    }
    for (const entry of envelope.metrics) {
      const mapped = mapMetadataField(entry);
      if (mapped !== undefined) {
        metricEntries.push(mapped);
      }
    }
  }

  const filteredDimensions =
    params.type === "metrics"
      ? []
      : filterMetadataEntries(dimensionEntries, params.search);
  const filteredMetrics =
    params.type === "dimensions"
      ? []
      : filterMetadataEntries(metricEntries, params.search);

  let dimensions: MetadataEntry[] = [];
  let metrics: MetadataEntry[] = [];
  let totalMatched: number;
  let nextOffset: number | undefined;

  if (params.type === "dimensions") {
    const page = paginateMetadataEntries(
      filteredDimensions,
      params.limit,
      params.offset,
    );
    dimensions = page.items;
    totalMatched = page.totalMatched;
    nextOffset = page.nextOffset;
  } else if (params.type === "metrics") {
    const page = paginateMetadataEntries(
      filteredMetrics,
      params.limit,
      params.offset,
    );
    metrics = page.items;
    totalMatched = page.totalMatched;
    nextOffset = page.nextOffset;
  } else {
    const combined = [...filteredDimensions, ...filteredMetrics];
    totalMatched = combined.length;
    const pageItems = combined.slice(
      params.offset,
      params.offset + params.limit,
    );
    nextOffset =
      params.offset + pageItems.length < totalMatched
        ? params.offset + pageItems.length
        : undefined;
    for (const item of pageItems) {
      if (filteredDimensions.some((d) => d.apiName === item.apiName)) {
        dimensions.push(item);
      } else {
        metrics.push(item);
      }
    }
  }

  const envelopeOut = {
    dimensions,
    metrics,
    totalMatched,
    localPagination: true as const,
    ...(nextOffset !== undefined ? { nextOffset } : {}),
  };

  const packed = packListWithinOutputBudget(
    envelopeOut,
    "dimensions",
    envelopeOut.dimensions,
  );
  const packed2 = packListWithinOutputBudget(packed, "metrics", packed.metrics);
  assertStructuredOutputWithinBudget(packed2);
  return packed2;
}
