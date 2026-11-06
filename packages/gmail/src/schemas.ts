import { z } from "zod";

import { LIST_DEFAULT_PAGE_SIZE, LIST_MAX_PAGE_SIZE } from "./constants.js";

const boundedTimeoutSchema = z.number().int().min(1_000).max(120_000);

export const gmailConfigSchema = z
  .object({
    requestTimeoutMs: boundedTimeoutSchema,
    accessToken: z.string().trim().min(1).optional(),
    scopes: z.array(z.string().trim().min(1)).min(1),
    useDomainDelegation: z.boolean(),
    delegatedUserEmail: z.string().trim().email().optional(),
    draftsEnabled: z.boolean(),
    sendEnabled: z.boolean(),
    hostSendApproved: z.boolean(),
    allowedRecipients: z.array(z.string().trim().min(1)).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.useDomainDelegation === true) {
      if (
        data.delegatedUserEmail === undefined ||
        data.delegatedUserEmail.length === 0
      ) {
        ctx.addIssue({
          code: "custom",
          message:
            "Delegated user email is required when domain-wide delegation is enabled.",
          path: ["delegatedUserEmail"],
        });
      }
    }
  });

export type GmailConfig = z.infer<typeof gmailConfigSchema>;

export const gmailListDefaultsSchema = z
  .object({
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(LIST_MAX_PAGE_SIZE)
      .default(LIST_DEFAULT_PAGE_SIZE),
  })
  .strict();
