import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  assertStructuredOutputWithinBudget,
  normalizeTruncatableProviderString,
  OUTPUT_MAX_PROVIDER_STRING_LENGTH,
} from "./output-budget.js";

const UNEXPECTED =
  "Google Search Console returned an unexpected URL Inspection payload.";

export interface NormalizedUrlInspection {
  readonly siteUrl: string;
  readonly inspectionUrl: string;
  readonly indexingVerdict?: string;
  readonly coverageState?: string;
  readonly lastCrawlTime?: string;
  readonly robotsTxtState?: string;
  readonly pageFetchState?: string;
  readonly googleCanonical?: string;
  readonly userCanonical?: string;
  readonly mobileUsabilityVerdict?: string;
  readonly richResultsVerdict?: string;
  readonly inspectionResultLink?: string;
  readonly notes: {
    readonly readOnly: "URL Inspection reads Google's known indexing state; it does not request live crawling or indexing.";
    readonly scope: "Requires OAuth scope https://www.googleapis.com/auth/webmasters (not readonly-only).";
  };
}

function optionalNestedString(
  root: unknown,
  path: readonly string[],
): string | undefined {
  let current: unknown = root;
  for (const key of path) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  if (typeof current !== "string") {
    return undefined;
  }
  return normalizeTruncatableProviderString(
    current,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  ).value;
}

export function mapUrlInspectionResponse(options: {
  readonly siteUrl: string;
  readonly inspectionUrl: string;
  readonly raw: unknown;
}): NormalizedUrlInspection {
  if (options.raw === null || typeof options.raw !== "object") {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }
  const record = options.raw as { inspectionResult?: unknown };
  const inspection = record.inspectionResult;
  if (inspection === null || typeof inspection !== "object") {
    throw new ConnectorSdkError("PROVIDER_ERROR", UNEXPECTED);
  }

  const indexStatus = (inspection as { indexStatusResult?: unknown })
    .indexStatusResult;
  const mobileUsability = (inspection as { mobileUsabilityResult?: unknown })
    .mobileUsabilityResult;
  const richResults = (inspection as { richResultsResult?: unknown })
    .richResultsResult;

  const result: NormalizedUrlInspection = {
    siteUrl: options.siteUrl,
    inspectionUrl: options.inspectionUrl,
    notes: {
      readOnly:
        "URL Inspection reads Google's known indexing state; it does not request live crawling or indexing.",
      scope:
        "Requires OAuth scope https://www.googleapis.com/auth/webmasters (not readonly-only).",
    },
    ...(optionalNestedString(indexStatus, ["verdict"]) !== undefined
      ? { indexingVerdict: optionalNestedString(indexStatus, ["verdict"]) }
      : {}),
    ...(optionalNestedString(indexStatus, ["coverageState"]) !== undefined
      ? { coverageState: optionalNestedString(indexStatus, ["coverageState"]) }
      : {}),
    ...(optionalNestedString(indexStatus, ["lastCrawlTime"]) !== undefined
      ? { lastCrawlTime: optionalNestedString(indexStatus, ["lastCrawlTime"]) }
      : {}),
    ...(optionalNestedString(indexStatus, ["robotsTxtState"]) !== undefined
      ? {
          robotsTxtState: optionalNestedString(indexStatus, ["robotsTxtState"]),
        }
      : {}),
    ...(optionalNestedString(indexStatus, ["pageFetchState"]) !== undefined
      ? {
          pageFetchState: optionalNestedString(indexStatus, ["pageFetchState"]),
        }
      : {}),
    ...(optionalNestedString(indexStatus, ["googleCanonical"]) !== undefined
      ? {
          googleCanonical: optionalNestedString(indexStatus, [
            "googleCanonical",
          ]),
        }
      : {}),
    ...(optionalNestedString(indexStatus, ["userCanonical"]) !== undefined
      ? { userCanonical: optionalNestedString(indexStatus, ["userCanonical"]) }
      : {}),
    ...(optionalNestedString(mobileUsability, ["verdict"]) !== undefined
      ? {
          mobileUsabilityVerdict: optionalNestedString(mobileUsability, [
            "verdict",
          ]),
        }
      : {}),
    ...(optionalNestedString(richResults, ["verdict"]) !== undefined
      ? {
          richResultsVerdict: optionalNestedString(richResults, ["verdict"]),
        }
      : {}),
    ...(optionalNestedString(inspection, ["inspectionResultLink"]) !== undefined
      ? {
          inspectionResultLink: optionalNestedString(inspection, [
            "inspectionResultLink",
          ]),
        }
      : {}),
  };

  assertStructuredOutputWithinBudget(result);
  return result;
}
