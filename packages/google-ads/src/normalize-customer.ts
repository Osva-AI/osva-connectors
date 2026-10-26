import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { OUTPUT_MAX_PROVIDER_STRING_LENGTH } from "./constants.js";
import {
  assertStructuredOutputWithinBudget,
  normalizeTruncatableProviderString,
  packListWithinOutputBudget,
} from "./output-budget.js";
import { parseCustomerId } from "./customer-id.js";
import { filterAllowedCustomers } from "./normalize-rows.js";

export function mapAccessibleCustomersResponse(
  raw: unknown,
  allowedCustomerIds: readonly string[] | undefined,
  limit: number,
): {
  customers: Array<{ customerId: string; resourceName: string }>;
  customersTruncated?: true;
  notes: string[];
} {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Ads returned an unexpected payload.",
    );
  }
  const resourceNames = (raw as { resourceNames?: unknown }).resourceNames;
  if (!Array.isArray(resourceNames)) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Ads returned an unexpected payload.",
    );
  }

  const customers: Array<{ customerId: string; resourceName: string }> = [];
  for (const entry of resourceNames.slice(0, limit * 2)) {
    if (typeof entry !== "string") {
      continue;
    }
    const match = entry.match(/^customers\/(\d{10})$/);
    if (match === null) {
      continue;
    }
    const customerId = match[1]!;
    try {
      parseCustomerId(customerId);
    } catch {
      continue;
    }
    if (!filterAllowedCustomers(customerId, allowedCustomerIds)) {
      continue;
    }
    customers.push({ customerId, resourceName: entry });
    if (customers.length >= limit) {
      break;
    }
  }

  const envelope = {
    notes: [
      "Listed customer IDs come from listAccessibleCustomers. Manager accounts may appear; reporting access depends on Google Ads permissions and login-customer-id.",
    ],
  };
  const packed = packListWithinOutputBudget(envelope, "customers", customers);
  assertStructuredOutputWithinBudget(packed);
  return packed;
}

export function mapCustomerGetResponse(
  raw: unknown,
  customerId: string,
): {
  customerId: string;
  descriptiveName: string;
  currencyCode: string | null;
  timeZone: string | null;
  manager: boolean | null;
  status: string | null;
} {
  const row = extractFirstSearchRow(raw);
  const customer = row?.customer;
  if (
    customer === null ||
    customer === undefined ||
    typeof customer !== "object"
  ) {
    throw new ConnectorSdkError(
      "NOT_FOUND",
      "Google Ads customer metadata was not found.",
    );
  }
  const c = customer as Record<string, unknown>;
  const name = normalizeTruncatableProviderString(
    c.descriptiveName ?? c.descriptive_name ?? "",
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  ).value;

  const currencyRaw = c.currencyCode ?? c.currency_code;
  const timeZoneRaw = c.timeZone ?? c.time_zone;
  const payload = {
    customerId,
    descriptiveName: name,
    currencyCode: typeof currencyRaw === "string" ? currencyRaw : null,
    timeZone: typeof timeZoneRaw === "string" ? timeZoneRaw : null,
    manager: typeof c.manager === "boolean" ? c.manager : null,
    status: typeof c.status === "string" ? c.status : null,
  };
  assertStructuredOutputWithinBudget(payload);
  return payload;
}

function extractFirstSearchRow(
  raw: unknown,
): Record<string, unknown> | undefined {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Google Ads returned an unexpected payload.",
    );
  }
  const results = (raw as { results?: unknown }).results;
  if (!Array.isArray(results) || results.length === 0) {
    return undefined;
  }
  const first = results[0];
  if (first === null || typeof first !== "object") {
    return undefined;
  }
  return first as Record<string, unknown>;
}
