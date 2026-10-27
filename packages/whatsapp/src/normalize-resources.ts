import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { OUTPUT_MAX_PROVIDER_STRING_LENGTH } from "./constants.js";
import {
  assertStructuredOutputWithinBudget,
  normalizeTruncatableProviderString,
  packListWithinOutputBudget,
} from "./output-budget.js";
import { filterAllowedPhoneNumberIds } from "./resolve-assets.js";

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

function readUntrustedString(value: unknown): {
  value: string | null;
  truncated?: true;
} {
  if (typeof value !== "string") {
    return { value: null };
  }
  const normalized = normalizeTruncatableProviderString(
    value,
    OUTPUT_MAX_PROVIDER_STRING_LENGTH,
  );
  if (normalized.value.length === 0) {
    return { value: null };
  }
  return {
    value: normalized.value,
    ...(normalized.truncated ? { truncated: true as const } : {}),
  };
}

export function mapBusinessAccountGetResponse(
  raw: unknown,
  wabaId: string,
): Record<string, unknown> {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "WhatsApp returned an unexpected business account payload.",
    );
  }
  const row = raw as Record<string, unknown>;
  const payload = {
    provenance: {
      source: "whatsapp.cloud_api",
      graphVersion: "v26.0",
      untrustedProviderText: true as const,
    },
    wabaId,
    name: readUntrustedString(row.name),
    timezoneId: readString(row.timezone_id),
    messageTemplateNamespace: readString(row.message_template_namespace),
    accountReviewStatus: readString(row.account_review_status),
    businessVerificationStatus: readString(
      row.business_verification_status ?? row.verification_status,
    ),
  };
  assertStructuredOutputWithinBudget(payload);
  return payload;
}

export function mapPhoneNumberRow(raw: unknown): Record<string, unknown> {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "WhatsApp returned an unexpected phone number row.",
    );
  }
  const row = raw as Record<string, unknown>;
  const display = readUntrustedString(row.display_phone_number);
  return {
    phoneNumberId: readString(row.id),
    displayPhoneNumber: display.value,
    ...(display.truncated
      ? { displayPhoneNumberTruncated: true as const }
      : {}),
    verifiedName: readUntrustedString(row.verified_name).value,
    codeVerificationStatus: readString(row.code_verification_status),
    qualityRating: readString(row.quality_rating),
    messagingLimitTier: readString(row.messaging_limit_tier),
    status: readString(row.status),
  };
}

export function mapPhoneNumberListResponse(
  rows: readonly unknown[],
  context: {
    allowedPhoneNumberIds?: readonly string[];
    nextCursor?: string;
    pagesFetched: number;
  },
): Record<string, unknown> {
  const mapped = rows.map(mapPhoneNumberRow).filter((row) => {
    const id = row.phoneNumberId;
    if (typeof id !== "string") {
      return false;
    }
    return filterAllowedPhoneNumberIds(id, context.allowedPhoneNumberIds);
  });

  const envelope = {
    provenance: {
      source: "whatsapp.cloud_api",
      edge: "phone_numbers",
      pagesFetched: context.pagesFetched,
      untrustedProviderText: true as const,
    },
    ...(context.nextCursor !== undefined
      ? { nextCursor: context.nextCursor }
      : {}),
  };

  const packed = packListWithinOutputBudget(envelope, "phoneNumbers", mapped);
  assertStructuredOutputWithinBudget(packed);
  return packed;
}

export function mapPhoneNumberGetResponse(
  raw: unknown,
  phoneNumberId: string,
): Record<string, unknown> {
  const row = mapPhoneNumberRow({ ...(raw as object), id: phoneNumberId });
  const payload = {
    provenance: {
      source: "whatsapp.cloud_api",
      untrustedProviderText: true as const,
    },
    ...row,
    phoneNumberId,
  };
  assertStructuredOutputWithinBudget(payload);
  return payload;
}

export function mapBusinessProfileGetResponse(
  raw: unknown,
  phoneNumberId: string,
): Record<string, unknown> {
  if (raw === null || typeof raw !== "object") {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "WhatsApp returned an unexpected business profile payload.",
    );
  }
  const row = raw as Record<string, unknown>;
  const data = row.data;
  const profile =
    Array.isArray(data) && data.length > 0 && typeof data[0] === "object"
      ? (data[0] as Record<string, unknown>)
      : row;

  const about = readUntrustedString(profile.about);
  const description = readUntrustedString(profile.description);

  const payload = {
    provenance: {
      source: "whatsapp.cloud_api",
      edge: "whatsapp_business_profile",
      untrustedProviderText: true as const,
    },
    phoneNumberId,
    about: about.value,
    ...(about.truncated ? { aboutTruncated: true as const } : {}),
    description: description.value,
    ...(description.truncated ? { descriptionTruncated: true as const } : {}),
    email: readString(profile.email),
    address: readUntrustedString(profile.address).value,
    vertical: readString(profile.vertical),
    websites: Array.isArray(profile.websites)
      ? profile.websites
          .slice(0, 5)
          .map((site) => readString(site))
          .filter((site): site is string => site !== null)
      : [],
  };
  assertStructuredOutputWithinBudget(payload);
  return payload;
}
