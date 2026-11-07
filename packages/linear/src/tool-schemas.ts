import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  LIST_DEFAULT_FIRST,
  LIST_MAX_FIRST,
  MAX_COMMENT_BODY_LENGTH,
  MAX_CURSOR_LENGTH,
  MAX_ISSUE_DESCRIPTION_LENGTH,
  MAX_ISSUE_SEARCH_QUERY_LENGTH,
  MAX_ISSUE_TITLE_LENGTH,
  MAX_LINEAR_ID_LENGTH,
} from "./constants.js";
import { parseLinearId } from "./linear-id.js";

const cursorSchema = z.string().trim().min(1).max(MAX_CURSOR_LENGTH).optional();

const linearIdSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1)
    .max(MAX_LINEAR_ID_LENGTH)
    .transform((value, ctx) => {
      try {
        return parseLinearId(value, label);
      } catch {
        ctx.addIssue({ code: "custom", message: `Invalid ${label}.` });
        return z.NEVER;
      }
    });

const firstSchema = z
  .number()
  .int()
  .min(1)
  .max(LIST_MAX_FIRST)
  .optional()
  .default(LIST_DEFAULT_FIRST);

const firstJson = {
  type: "integer",
  minimum: 1,
  maximum: LIST_MAX_FIRST,
} as const;

export const viewerGetInputSchema = z.object({}).strict();

export const viewerGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} as const satisfies DefineToolOptions["inputSchema"];

export const teamListInputSchema = z
  .object({
    first: firstSchema,
    after: cursorSchema,
  })
  .strict();

export const teamListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    first: firstJson,
    after: { type: "string", minLength: 1, maxLength: MAX_CURSOR_LENGTH },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const issueListInputSchema = z
  .object({
    first: firstSchema,
    after: cursorSchema,
    teamId: linearIdSchema("team ID").optional(),
    projectId: linearIdSchema("project ID").optional(),
  })
  .strict();

export const issueListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    first: firstJson,
    after: { type: "string", minLength: 1, maxLength: MAX_CURSOR_LENGTH },
    teamId: { type: "string", minLength: 1, maxLength: MAX_LINEAR_ID_LENGTH },
    projectId: {
      type: "string",
      minLength: 1,
      maxLength: MAX_LINEAR_ID_LENGTH,
    },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const issueGetInputSchema = z
  .object({
    issueId: linearIdSchema("issue ID"),
  })
  .strict();

export const issueGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["issueId"],
  properties: {
    issueId: { type: "string", minLength: 1, maxLength: MAX_LINEAR_ID_LENGTH },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const issueSearchInputSchema = z
  .object({
    query: z.string().trim().min(1).max(MAX_ISSUE_SEARCH_QUERY_LENGTH),
    first: firstSchema,
    after: cursorSchema,
  })
  .strict();

export const issueSearchInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: {
    query: {
      type: "string",
      minLength: 1,
      maxLength: MAX_ISSUE_SEARCH_QUERY_LENGTH,
    },
    first: firstJson,
    after: { type: "string", minLength: 1, maxLength: MAX_CURSOR_LENGTH },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const projectListInputSchema = z
  .object({
    first: firstSchema,
    after: cursorSchema,
    teamId: linearIdSchema("team ID").optional(),
  })
  .strict();

export const projectListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    first: firstJson,
    after: { type: "string", minLength: 1, maxLength: MAX_CURSOR_LENGTH },
    teamId: { type: "string", minLength: 1, maxLength: MAX_LINEAR_ID_LENGTH },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const projectGetInputSchema = z
  .object({
    projectId: linearIdSchema("project ID"),
  })
  .strict();

export const projectGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["projectId"],
  properties: {
    projectId: {
      type: "string",
      minLength: 1,
      maxLength: MAX_LINEAR_ID_LENGTH,
    },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const issueCreateInputSchema = z
  .object({
    teamId: linearIdSchema("team ID"),
    title: z.string().trim().min(1).max(MAX_ISSUE_TITLE_LENGTH),
    description: z.string().max(MAX_ISSUE_DESCRIPTION_LENGTH).optional(),
    projectId: linearIdSchema("project ID").optional(),
  })
  .strict();

export const issueCreateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["teamId", "title"],
  properties: {
    teamId: { type: "string", minLength: 1, maxLength: MAX_LINEAR_ID_LENGTH },
    title: { type: "string", minLength: 1, maxLength: MAX_ISSUE_TITLE_LENGTH },
    description: {
      type: "string",
      maxLength: MAX_ISSUE_DESCRIPTION_LENGTH,
    },
    projectId: {
      type: "string",
      minLength: 1,
      maxLength: MAX_LINEAR_ID_LENGTH,
    },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const issueUpdateInputSchema = z
  .object({
    issueId: linearIdSchema("issue ID"),
    title: z.string().trim().min(1).max(MAX_ISSUE_TITLE_LENGTH).optional(),
    description: z.string().max(MAX_ISSUE_DESCRIPTION_LENGTH).optional(),
    stateId: linearIdSchema("workflow state ID").optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.title === undefined &&
      value.description === undefined &&
      value.stateId === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "At least one issue field must be provided.",
      });
    }
  });

export const issueUpdateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["issueId"],
  properties: {
    issueId: { type: "string", minLength: 1, maxLength: MAX_LINEAR_ID_LENGTH },
    title: { type: "string", minLength: 1, maxLength: MAX_ISSUE_TITLE_LENGTH },
    description: {
      type: "string",
      maxLength: MAX_ISSUE_DESCRIPTION_LENGTH,
    },
    stateId: { type: "string", minLength: 1, maxLength: MAX_LINEAR_ID_LENGTH },
  },
} as const satisfies DefineToolOptions["inputSchema"];

export const commentCreateInputSchema = z
  .object({
    issueId: linearIdSchema("issue ID"),
    body: z.string().trim().min(1).max(MAX_COMMENT_BODY_LENGTH),
  })
  .strict();

export const commentCreateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["issueId", "body"],
  properties: {
    issueId: { type: "string", minLength: 1, maxLength: MAX_LINEAR_ID_LENGTH },
    body: { type: "string", minLength: 1, maxLength: MAX_COMMENT_BODY_LENGTH },
  },
} as const satisfies DefineToolOptions["inputSchema"];
