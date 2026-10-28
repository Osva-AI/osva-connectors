import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  MAX_FILTERS_PER_GROUP,
  MAX_SEARCH_FILTER_GROUPS,
} from "./constants.js";
import {
  assertObjectTypeAllowed,
  isAllowlistedPropertyName,
  type CrmObjectType,
} from "./property-allowlist.js";

export const SEARCH_OPERATORS = [
  "EQ",
  "NEQ",
  "GT",
  "GTE",
  "LT",
  "LTE",
  "IN",
] as const;

export type SearchOperator = (typeof SEARCH_OPERATORS)[number];

export interface SearchFilterInput {
  readonly propertyName: string;
  readonly operator: SearchOperator;
  readonly value?: string;
  readonly values?: readonly string[];
}

export interface SearchFilterGroupInput {
  readonly filters: readonly SearchFilterInput[];
}

export interface CrmSearchInput {
  readonly objectType: CrmObjectType;
  readonly filterGroups: readonly SearchFilterGroupInput[];
}

function normalizeScalarValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 512) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Search filter value is not valid.",
    );
  }
  return trimmed;
}

function normalizeInValues(values: readonly string[]): string[] {
  if (values.length === 0 || values.length > 100) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Search filter IN values are not valid.",
    );
  }
  return values.map(normalizeScalarValue);
}

export function buildHubspotSearchBody(
  input: CrmSearchInput,
  options: {
    readonly allowedObjectTypes: readonly CrmObjectType[];
    readonly includePii: boolean;
    readonly limit: number;
    readonly after?: string;
    readonly properties: readonly string[];
  },
): Record<string, unknown> {
  assertObjectTypeAllowed(input.objectType, options.allowedObjectTypes);

  if (
    input.filterGroups.length === 0 ||
    input.filterGroups.length > MAX_SEARCH_FILTER_GROUPS
  ) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Search filterGroups are not valid.",
    );
  }

  const filterGroups = input.filterGroups.map((group) => {
    if (
      group.filters.length === 0 ||
      group.filters.length > MAX_FILTERS_PER_GROUP
    ) {
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Search filters are not valid.",
      );
    }
    const filters = group.filters.map((filter) => {
      if (
        !isAllowlistedPropertyName(
          input.objectType,
          filter.propertyName,
          options.includePii,
        )
      ) {
        throw new ConnectorSdkError(
          "INVALID_INPUT",
          "Search filter property is not allowlisted.",
        );
      }
      if (!SEARCH_OPERATORS.includes(filter.operator)) {
        throw new ConnectorSdkError(
          "INVALID_INPUT",
          "Search filter operator is not supported.",
        );
      }
      if (filter.operator === "IN") {
        const values =
          filter.values !== undefined
            ? normalizeInValues(filter.values)
            : filter.value !== undefined
              ? normalizeInValues([filter.value])
              : undefined;
        if (values === undefined) {
          throw new ConnectorSdkError(
            "INVALID_INPUT",
            "Search filter IN requires values.",
          );
        }
        return {
          propertyName: filter.propertyName,
          operator: filter.operator,
          values,
        };
      }
      if (filter.value === undefined) {
        throw new ConnectorSdkError(
          "INVALID_INPUT",
          "Search filter value is required.",
        );
      }
      return {
        propertyName: filter.propertyName,
        operator: filter.operator,
        value: normalizeScalarValue(filter.value),
      };
    });
    return { filters };
  });

  const body: Record<string, unknown> = {
    filterGroups,
    properties: [...options.properties],
    limit: options.limit,
  };
  if (options.after !== undefined) {
    body.after = options.after;
  }
  return body;
}
