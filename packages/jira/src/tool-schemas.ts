import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  LIST_DEFAULT_PAGE_SIZE,
  LIST_MAX_PAGE_SIZE,
  MAX_JQL_LENGTH,
  MAX_NEXT_PAGE_TOKEN_LENGTH,
  MAX_PROJECT_KEY_LENGTH,
  MAX_SUMMARY_LENGTH,
} from "./constants.js";
import {
  parseIssueKey,
  parseProjectKey,
  validateNextPageToken,
} from "./jira-id.js";

const maxResultsSchema = z
  .number()
  .int()
  .min(1)
  .max(LIST_MAX_PAGE_SIZE)
  .optional()
  .default(LIST_DEFAULT_PAGE_SIZE);

const maxResultsJson = {
  type: "integer",
  minimum: 1,
  maximum: LIST_MAX_PAGE_SIZE,
} as const;

const nextPageTokenSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_NEXT_PAGE_TOKEN_LENGTH)
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) {
      return undefined;
    }
    try {
      return validateNextPageToken(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid nextPageToken." });
      return z.NEVER;
    }
  });

const projectKeySchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1)
    .max(MAX_PROJECT_KEY_LENGTH)
    .transform((value, ctx) => {
      try {
        return parseProjectKey(value, label);
      } catch {
        ctx.addIssue({ code: "custom", message: `Invalid ${label}.` });
        return z.NEVER;
      }
    });

const issueKeySchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform((value, ctx) => {
      try {
        return parseIssueKey(value, label);
      } catch {
        ctx.addIssue({ code: "custom", message: `Invalid ${label}.` });
        return z.NEVER;
      }
    });

export const projectListInputSchema = z
  .object({
    startAt: z.number().int().min(0).optional().default(0),
    maxResults: maxResultsSchema,
  })
  .strict();

export const projectListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    startAt: { type: "integer", minimum: 0 },
    maxResults: maxResultsJson,
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const projectGetInputSchema = z
  .object({
    projectIdOrKey: projectKeySchema("project key"),
  })
  .strict();

export const projectGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["projectIdOrKey"],
  properties: {
    projectIdOrKey: {
      type: "string",
      minLength: 1,
      maxLength: MAX_PROJECT_KEY_LENGTH,
    },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const issueSearchInputSchema = z
  .object({
    jql: z.string().trim().min(1).max(MAX_JQL_LENGTH),
    maxResults: maxResultsSchema,
    nextPageToken: nextPageTokenSchema,
    fields: z.array(z.string().trim().min(1).max(128)).max(64).optional(),
  })
  .strict();

export const issueSearchInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["jql"],
  properties: {
    jql: { type: "string", minLength: 1, maxLength: MAX_JQL_LENGTH },
    maxResults: maxResultsJson,
    nextPageToken: {
      type: "string",
      minLength: 1,
      maxLength: MAX_NEXT_PAGE_TOKEN_LENGTH,
    },
    fields: {
      type: "array",
      maxItems: 64,
      items: { type: "string", minLength: 1, maxLength: 128 },
    },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const issueGetInputSchema = z
  .object({
    issueKey: issueKeySchema("issue key"),
  })
  .strict();

export const issueGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["issueKey"],
  properties: {
    issueKey: { type: "string", minLength: 1, maxLength: 64 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const issueTransitionsListInputSchema = z
  .object({
    issueKey: issueKeySchema("issue key"),
  })
  .strict();

export const issueTransitionsListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["issueKey"],
  properties: {
    issueKey: { type: "string", minLength: 1, maxLength: 64 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const issueCreateInputSchema = z
  .object({
    projectKey: projectKeySchema("project key"),
    issueTypeId: z.string().trim().min(1).max(64),
    summary: z.string().trim().min(1).max(MAX_SUMMARY_LENGTH),
    descriptionText: z.string().trim().min(1).max(8192).optional(),
  })
  .strict();

export const issueCreateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["projectKey", "issueTypeId", "summary"],
  properties: {
    projectKey: {
      type: "string",
      minLength: 1,
      maxLength: MAX_PROJECT_KEY_LENGTH,
    },
    issueTypeId: { type: "string", minLength: 1, maxLength: 64 },
    summary: { type: "string", minLength: 1, maxLength: MAX_SUMMARY_LENGTH },
    descriptionText: { type: "string", minLength: 1, maxLength: 8192 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const issueUpdateInputSchema = z
  .object({
    issueKey: issueKeySchema("issue key"),
    summary: z.string().trim().min(1).max(MAX_SUMMARY_LENGTH).optional(),
    descriptionText: z.string().trim().min(1).max(8192).optional(),
  })
  .strict()
  .refine(
    (data) => data.summary !== undefined || data.descriptionText !== undefined,
    { message: "At least one field must be updated." },
  );

export const issueUpdateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["issueKey"],
  properties: {
    issueKey: { type: "string", minLength: 1, maxLength: 64 },
    summary: { type: "string", minLength: 1, maxLength: MAX_SUMMARY_LENGTH },
    descriptionText: { type: "string", minLength: 1, maxLength: 8192 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const issueCommentCreateInputSchema = z
  .object({
    issueKey: issueKeySchema("issue key"),
    bodyText: z.string().trim().min(1).max(8192),
  })
  .strict();

export const issueCommentCreateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["issueKey", "bodyText"],
  properties: {
    issueKey: { type: "string", minLength: 1, maxLength: 64 },
    bodyText: { type: "string", minLength: 1, maxLength: 8192 },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const issueTransitionInputSchema = z
  .object({
    issueKey: issueKeySchema("issue key"),
    transitionId: z.string().trim().min(1).max(64),
  })
  .strict();

export const issueTransitionInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["issueKey", "transitionId"],
  properties: {
    issueKey: { type: "string", minLength: 1, maxLength: 64 },
    transitionId: { type: "string", minLength: 1, maxLength: 64 },
  },
} as const satisfies DefineToolOptions["inputSchema"];
