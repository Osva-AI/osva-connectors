import { z } from "zod";

import {
  MAX_MAX_ROWS,
  MAX_REQUEST_TIMEOUT_MS,
  MIN_MAX_ROWS,
  MIN_REQUEST_TIMEOUT_MS,
} from "./constants.js";

export const whatsappConfigSchema = z.object({
  accessToken: z.string().min(1).max(4096),
  wabaId: z.string().min(1).max(32),
  phoneNumberId: z.string().min(1).max(32),
  appSecret: z.string().min(1).max(256).optional(),
  allowedPhoneNumberIds: z.array(z.string().min(1).max(32)).optional(),
  allowedRecipients: z.array(z.string().min(8).max(16)).optional(),
  sendEnabled: z.boolean(),
  requestTimeoutMs: z
    .number()
    .int()
    .min(MIN_REQUEST_TIMEOUT_MS)
    .max(MAX_REQUEST_TIMEOUT_MS),
  maxRows: z.number().int().min(MIN_MAX_ROWS).max(MAX_MAX_ROWS),
});

export type WhatsAppConfig = z.infer<typeof whatsappConfigSchema>;
