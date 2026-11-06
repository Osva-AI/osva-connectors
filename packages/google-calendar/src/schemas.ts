import { z } from "zod";

import { LIST_DEFAULT_PAGE_SIZE, LIST_MAX_PAGE_SIZE } from "./constants.js";

const boundedTimeoutSchema = z.number().int().min(1_000).max(120_000);

export const googleCalendarConfigSchema = z
  .object({
    requestTimeoutMs: boundedTimeoutSchema,
    accessToken: z.string().trim().min(1).optional(),
    scopes: z.array(z.string().trim().min(1)).min(1),
    useDomainDelegation: z.boolean(),
    delegatedUserEmail: z.string().trim().email().optional(),
    writeEnabled: z.boolean(),
    hostMutationsApproved: z.boolean(),
    allowedCalendarIds: z.array(z.string().trim().min(1)).optional(),
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

export type GoogleCalendarConfig = z.infer<typeof googleCalendarConfigSchema>;

export const calendarListDefaultsSchema = z
  .object({
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(LIST_MAX_PAGE_SIZE)
      .default(LIST_DEFAULT_PAGE_SIZE),
  })
  .strict();
