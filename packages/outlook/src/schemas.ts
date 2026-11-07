import { z } from "zod";

const boundedTimeoutSchema = z.number().int().min(1_000).max(120_000);

export const outlookConfigSchema = z
  .object({
    accessToken: z.string().trim().min(1),
    requestTimeoutMs: boundedTimeoutSchema,
    allowedMailFolderIds: z.array(z.string().trim().min(1)).optional(),
    allowedCalendarIds: z.array(z.string().trim().min(1)).optional(),
    sendEnabled: z.boolean(),
    hostSendApproved: z.boolean(),
    allowedRecipients: z.array(z.string().trim().min(1)).optional(),
    writeEnabled: z.boolean(),
    hostWritesApproved: z.boolean(),
  })
  .strict();

export type OutlookConfig = z.infer<typeof outlookConfigSchema>;
