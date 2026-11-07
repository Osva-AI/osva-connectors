import { z } from "zod";

import { LIST_DEFAULT_PAGE_SIZE, LIST_MAX_PAGE_SIZE } from "./constants.js";

const boundedTimeoutSchema = z.number().int().min(1_000).max(120_000);

const channelDestinationSchema = z
  .object({
    teamId: z.string().trim().min(1),
    channelId: z.string().trim().min(1),
  })
  .strict();

export const teamsConfigSchema = z
  .object({
    accessToken: z.string().trim().min(1),
    requestTimeoutMs: boundedTimeoutSchema,
    sendEnabled: z.boolean(),
    hostSendApproved: z.boolean(),
    allowedTeamIds: z.array(z.string().trim().min(1)).optional(),
    allowedChannelIds: z.array(z.string().trim().min(1)).optional(),
    allowedChatIds: z.array(z.string().trim().min(1)).optional(),
    allowedChannelDestinations: z.array(channelDestinationSchema).optional(),
    allowedChatDestinations: z.array(z.string().trim().min(1)).optional(),
    graphApiBase: z.string().trim().min(1),
  })
  .strict();

export type TeamsConfig = z.infer<typeof teamsConfigSchema>;

export const teamsListDefaultsSchema = z
  .object({
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(LIST_MAX_PAGE_SIZE)
      .default(LIST_DEFAULT_PAGE_SIZE),
  })
  .strict();
