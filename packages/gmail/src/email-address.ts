import { z } from "zod";

import { ConnectorSdkError } from "@osva-ai/connector-sdk";

/** Single bare addr-spec (no display name, no groups). Used for allowlist and MIME assembly. */
const bareAddrSpecSchema = z
  .string()
  .trim()
  .min(3)
  .max(320)
  .email()
  .refine((v) => !/[\0\r\n]/.test(v), "Invalid email.")
  .refine(
    (v) => !/[<>]/.test(v),
    "Display names and angle brackets are not allowed.",
  );

/**
 * Canonicalize a tool-supplied or env-supplied address to a comparable lowercase bare form.
 * Rejects header injection, group syntax, and angle-bracket tricks.
 */
export function canonicalRecipientEmail(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ConnectorSdkError("INVALID_INPUT", "Email address is empty.");
  }
  if (/[\0\r\n]/.test(trimmed)) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Email address contains invalid characters.",
    );
  }
  const parsed = parseSingleAddrSpec(trimmed);
  const lower = parsed.toLowerCase();
  const check = bareAddrSpecSchema.safeParse(lower);
  if (!check.success) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Invalid email address format.",
    );
  }
  return lower;
}

function parseSingleAddrSpec(input: string): string {
  if (input.includes(",")) {
    throw new ConnectorSdkError(
      "INVALID_INPUT",
      "Multiple addresses in one field are not supported.",
    );
  }
  const angle = input.match(/^[^<]*<([^>]+)>$/);
  const core = (angle?.[1] ?? input).trim();
  if (core.includes("<") || core.includes(">")) {
    throw new ConnectorSdkError("INVALID_INPUT", "Invalid address encoding.");
  }
  return core;
}

export function parseAllowlistEmailEntry(raw: string): string {
  return canonicalRecipientEmail(raw);
}
