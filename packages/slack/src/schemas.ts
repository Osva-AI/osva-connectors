import { z } from "zod";

import {
  MAX_REQUEST_TIMEOUT_MS,
  MIN_REQUEST_TIMEOUT_MS,
  SLACK_CHANNEL_ID_PATTERN,
} from "./constants.js";

export const slackConfigSchema = z
  .object({
    botToken: z.string().min(1),
    requestTimeoutMs: z
      .number()
      .int()
      .min(MIN_REQUEST_TIMEOUT_MS)
      .max(MAX_REQUEST_TIMEOUT_MS),
    allowedChannelIds: z
      .array(z.string().regex(SLACK_CHANNEL_ID_PATTERN))
      .optional(),
    writeEnabled: z.boolean(),
  })
  .strict();

export type SlackConfig = z.infer<typeof slackConfigSchema>;
