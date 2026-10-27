import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { accountIdDigits, normalizeAccountIdInput } from "./account-id.js";
import { OUTPUT_MAX_PROVIDER_STRING_LENGTH } from "./constants.js";
import {
  assertStructuredOutputWithinBudget,
  normalizeTruncatableProviderString,
  packListWithinOutputBudget,
} from "./output-budget.js";
import { filterAllowedAccounts } from "./resolve-account.js";

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = normalizeTruncatableProviderString(
    value,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  return normalized.value.length > 0 ? normalized.value : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

export function mapAdAccountRow(raw: unknown): Record<string, unknown> {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Meta Ads returned an unexpected ad account row.",
    );
  }
  const row = raw as Record<string, unknown>;
  const accountIdRaw =
    readString(row.account_id) ??
    readString(row.id) ??
    readString(row.accountId);
  const accountId =
    accountIdRaw !== null ? normalizeAccountIdInput(accountIdRaw) : null;
  return {
    accountId,
    name: readString(row.name),
    currency: readString(row.currency),
    timezone: readString(row.timezone_name ?? row.timezone),
    accountStatus: readNumber(row.account_status),
    amountSpent: readString(row.amount_spent),
    disableReason: readNumber(row.disable_reason),
  };
}

export function mapAdAccountListResponse(
  rows: readonly unknown[],
  context: {
    allowedAccountIds?: readonly string[];
    nextCursor?: string;
    pagesFetched: number;
  },
): Record<string, unknown> {
  const mapped = rows.map(mapAdAccountRow).filter((row) => {
    const id = row.accountId;
    if (typeof id !== "string") {
      return false;
    }
    return filterAllowedAccounts(id, context.allowedAccountIds);
  });

  const envelope = {
    provenance: {
      source: "meta.marketing_api",
      edge: "me/adaccounts",
      pagesFetched: context.pagesFetched,
    },
    ...(context.nextCursor !== undefined
      ? { nextCursor: context.nextCursor }
      : {}),
  };

  const packed = packListWithinOutputBudget(envelope, "accounts", mapped);
  assertStructuredOutputWithinBudget(packed);
  return packed;
}

export function mapAdAccountGetResponse(
  raw: unknown,
  accountId: string,
): Record<string, unknown> {
  const row = mapAdAccountRow({
    ...(raw as object),
    account_id: accountIdDigits(accountId),
  });
  const result = {
    provenance: {
      source: "meta.marketing_api",
      accountId,
    },
    account: row,
  };
  assertStructuredOutputWithinBudget(result);
  return result;
}

export function mapCampaignRow(raw: unknown): Record<string, unknown> {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Meta Ads returned an unexpected campaign row.",
    );
  }
  const row = raw as Record<string, unknown>;
  return {
    id: readString(row.id),
    name: readString(row.name),
    objective: readString(row.objective),
    status: readString(row.status),
    effectiveStatus: readString(row.effective_status),
    dailyBudget: readString(row.daily_budget),
    lifetimeBudget: readString(row.lifetime_budget),
    buyingType: readString(row.buying_type),
  };
}

export function mapCampaignListResponse(
  rows: readonly unknown[],
  context: {
    accountId: string;
    nextCursor?: string;
    pagesFetched: number;
  },
): Record<string, unknown> {
  const mapped = rows.map(mapCampaignRow);
  const envelope = {
    provenance: {
      source: "meta.marketing_api",
      accountId: context.accountId,
      edge: "campaigns",
      pagesFetched: context.pagesFetched,
    },
    ...(context.nextCursor !== undefined
      ? { nextCursor: context.nextCursor }
      : {}),
  };
  const packed = packListWithinOutputBudget(envelope, "campaigns", mapped);
  assertStructuredOutputWithinBudget(packed);
  return packed;
}

export function mapAdSetRow(raw: unknown): Record<string, unknown> {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Meta Ads returned an unexpected ad set row.",
    );
  }
  const row = raw as Record<string, unknown>;
  const targeting = row.targeting;
  let targetingSummary: Record<string, unknown> | null = null;
  if (targeting !== null && typeof targeting === "object") {
    const t = targeting as Record<string, unknown>;
    const geo = t.geo_locations;
    let countries: string[] | null = null;
    if (geo !== null && typeof geo === "object") {
      const g = geo as Record<string, unknown>;
      if (Array.isArray(g.countries)) {
        countries = g.countries
          .filter((entry): entry is string => typeof entry === "string")
          .slice(0, 8);
      }
    }
    targetingSummary = {
      countries,
      ageMin: readNumber(t.age_min),
      ageMax: readNumber(t.age_max),
      genders: Array.isArray(t.genders) ? t.genders.slice(0, 8) : null,
    };
  }
  return {
    id: readString(row.id),
    name: readString(row.name),
    campaignId: readString(row.campaign_id),
    status: readString(row.status),
    effectiveStatus: readString(row.effective_status),
    dailyBudget: readString(row.daily_budget),
    lifetimeBudget: readString(row.lifetime_budget),
    optimizationGoal: readString(row.optimization_goal),
    billingEvent: readString(row.billing_event),
    targetingSummary,
  };
}

export function mapAdSetListResponse(
  rows: readonly unknown[],
  context: {
    accountId: string;
    campaignId?: string;
    nextCursor?: string;
    pagesFetched: number;
  },
): Record<string, unknown> {
  const mapped = rows.map(mapAdSetRow);
  const envelope = {
    provenance: {
      source: "meta.marketing_api",
      accountId: context.accountId,
      ...(context.campaignId !== undefined
        ? { campaignId: context.campaignId }
        : {}),
      edge: "adsets",
      pagesFetched: context.pagesFetched,
    },
    ...(context.nextCursor !== undefined
      ? { nextCursor: context.nextCursor }
      : {}),
  };
  const packed = packListWithinOutputBudget(envelope, "adSets", mapped);
  assertStructuredOutputWithinBudget(packed);
  return packed;
}

export function mapAdRow(raw: unknown): Record<string, unknown> {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Meta Ads returned an unexpected ad row.",
    );
  }
  const row = raw as Record<string, unknown>;
  const creative = row.creative;
  let creativeRef: Record<string, unknown> | null = null;
  if (creative !== null && typeof creative === "object") {
    const c = creative as Record<string, unknown>;
    creativeRef = {
      id: readString(c.id),
      name: readString(c.name),
    };
  }
  return {
    id: readString(row.id),
    name: readString(row.name),
    campaignId: readString(row.campaign_id),
    adSetId: readString(row.adset_id),
    status: readString(row.status),
    effectiveStatus: readString(row.effective_status),
    creative: creativeRef,
  };
}

export function mapAdListResponse(
  rows: readonly unknown[],
  context: {
    accountId: string;
    nextCursor?: string;
    pagesFetched: number;
  },
): Record<string, unknown> {
  const mapped = rows.map(mapAdRow);
  const envelope = {
    provenance: {
      source: "meta.marketing_api",
      accountId: context.accountId,
      edge: "ads",
      pagesFetched: context.pagesFetched,
    },
    ...(context.nextCursor !== undefined
      ? { nextCursor: context.nextCursor }
      : {}),
  };
  const packed = packListWithinOutputBudget(envelope, "ads", mapped);
  assertStructuredOutputWithinBudget(packed);
  return packed;
}
