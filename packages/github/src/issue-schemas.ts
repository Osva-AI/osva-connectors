import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  ISSUE_COMMENT_CREATE_MAX_BODY_LENGTH,
  ISSUE_CREATE_MAX_BODY_LENGTH,
  ISSUE_CREATE_MAX_TITLE_LENGTH,
  ISSUE_LIST_DEFAULT_PER_PAGE,
  ISSUE_LIST_MAX_PAGE,
  ISSUE_LIST_MAX_PER_PAGE,
  OUTPUT_MAX_COMMENT_BODY,
  OUTPUT_MAX_GITHUB_LOGIN,
  OUTPUT_MAX_ISSUE_TITLE,
  OUTPUT_MAX_ISO_TIMESTAMP,
  OUTPUT_MAX_URL,
} from "./constants.js";
import { githubSlugSchema } from "./schemas.js";

const issueStateSchema = z.enum(["open", "closed", "all"]);

const paginationPageSchema = z
  .number()
  .int("Page must be an integer.")
  .min(1, "Page must be at least 1.")
  .max(ISSUE_LIST_MAX_PAGE, `Page must be at most ${ISSUE_LIST_MAX_PAGE}.`);

const paginationPerPageSchema = z
  .number()
  .int("perPage must be an integer.")
  .min(1, "perPage must be at least 1.")
  .max(
    ISSUE_LIST_MAX_PER_PAGE,
    `perPage must be at most ${ISSUE_LIST_MAX_PER_PAGE}.`,
  );

const issueNumberSchema = z
  .number()
  .int("Issue number must be an integer.")
  .min(1, "Issue number must be a positive integer.");

export const issueListInputSchema = z.object({
  owner: githubSlugSchema,
  repo: githubSlugSchema,
  state: issueStateSchema.optional().default("open"),
  perPage: z.coerce
    .number()
    .pipe(paginationPerPageSchema)
    .optional()
    .default(ISSUE_LIST_DEFAULT_PER_PAGE),
  page: z.coerce.number().pipe(paginationPageSchema).optional().default(1),
});

export type IssueListInput = z.infer<typeof issueListInputSchema>;

export const issueGetInputSchema = z.object({
  owner: githubSlugSchema,
  repo: githubSlugSchema,
  issueNumber: z.coerce.number().pipe(issueNumberSchema),
});

export type IssueGetInput = z.infer<typeof issueGetInputSchema>;

const issueCreateTitleSchema = z
  .string()
  .trim()
  .min(1, "Title is required.")
  .max(
    ISSUE_CREATE_MAX_TITLE_LENGTH,
    `Title must be at most ${ISSUE_CREATE_MAX_TITLE_LENGTH} characters.`,
  );

const issueCreateBodySchema = z
  .string()
  .max(
    ISSUE_CREATE_MAX_BODY_LENGTH,
    `Body must be at most ${ISSUE_CREATE_MAX_BODY_LENGTH} characters.`,
  )
  .optional();

export const issueCreateInputSchema = z.object({
  owner: githubSlugSchema,
  repo: githubSlugSchema,
  title: issueCreateTitleSchema,
  body: issueCreateBodySchema,
});

export type IssueCreateInput = z.infer<typeof issueCreateInputSchema>;

export const issueListInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["owner", "repo"],
  properties: {
    owner: {
      type: "string",
      minLength: 1,
      maxLength: 100,
      description: "GitHub repository owner (user or organization login).",
    },
    repo: {
      type: "string",
      minLength: 1,
      maxLength: 100,
      description: "GitHub repository name.",
    },
    state: {
      type: "string",
      enum: ["open", "closed", "all"],
      default: "open",
      description: "Issue state filter.",
    },
    perPage: {
      type: "integer",
      minimum: 1,
      maximum: ISSUE_LIST_MAX_PER_PAGE,
      default: ISSUE_LIST_DEFAULT_PER_PAGE,
      description: "Number of issues per GitHub API page (max 100).",
    },
    page: {
      type: "integer",
      minimum: 1,
      maximum: ISSUE_LIST_MAX_PAGE,
      default: 1,
      description: "GitHub API page index (1-based, max 100).",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const issueGetInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["owner", "repo", "issueNumber"],
  properties: {
    owner: {
      type: "string",
      minLength: 1,
      maxLength: 100,
    },
    repo: {
      type: "string",
      minLength: 1,
      maxLength: 100,
    },
    issueNumber: {
      type: "integer",
      minimum: 1,
      description: "GitHub issue number.",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const issueCreateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["owner", "repo", "title"],
  properties: {
    owner: {
      type: "string",
      minLength: 1,
      maxLength: 100,
      description: "GitHub repository owner (user or organization login).",
    },
    repo: {
      type: "string",
      minLength: 1,
      maxLength: 100,
      description: "GitHub repository name.",
    },
    title: {
      type: "string",
      minLength: 1,
      maxLength: ISSUE_CREATE_MAX_TITLE_LENGTH,
      description: "Issue title (Markdown plain text).",
    },
    body: {
      type: "string",
      maxLength: ISSUE_CREATE_MAX_BODY_LENGTH,
      description: "Optional issue body (Markdown).",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const normalizedIssueSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().max(OUTPUT_MAX_ISSUE_TITLE),
  titleTruncated: z.boolean().optional(),
  state: z.enum(["open", "closed"]),
  htmlUrl: z.string().url().max(OUTPUT_MAX_URL),
  createdAt: z.string().max(OUTPUT_MAX_ISO_TIMESTAMP),
  updatedAt: z.string().max(OUTPUT_MAX_ISO_TIMESTAMP),
  closedAt: z.string().max(OUTPUT_MAX_ISO_TIMESTAMP).nullable(),
  authorLogin: z.string().max(OUTPUT_MAX_GITHUB_LOGIN).nullable(),
  authorLoginTruncated: z.boolean().optional(),
  labels: z.array(z.string().max(100)),
  commentsCount: z.number().int().nonnegative(),
  labelsTruncated: z.boolean().optional(),
});

export type NormalizedIssue = z.infer<typeof normalizedIssueSchema>;

export const issueListOutputSchema = z.object({
  issues: z.array(normalizedIssueSchema),
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
  hasNextPage: z.boolean().optional(),
  /** Present when fewer issues are returned than GitHub supplied because of connector output budget. */
  issuesTruncated: z.boolean().optional(),
});

export type IssueListOutput = z.infer<typeof issueListOutputSchema>;

export const issueCreateOutputSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().max(OUTPUT_MAX_ISSUE_TITLE),
  titleTruncated: z.boolean().optional(),
  state: z.enum(["open", "closed"]),
  htmlUrl: z.string().url().max(OUTPUT_MAX_URL),
  createdAt: z.string().max(OUTPUT_MAX_ISO_TIMESTAMP),
  authorLogin: z.string().max(OUTPUT_MAX_GITHUB_LOGIN).nullable(),
  authorLoginTruncated: z.boolean().optional(),
});

export type IssueCreateOutput = z.infer<typeof issueCreateOutputSchema>;

const issueCommentCreateBodySchema = z
  .string()
  .trim()
  .min(1, "Body is required.")
  .max(
    ISSUE_COMMENT_CREATE_MAX_BODY_LENGTH,
    `Body must be at most ${ISSUE_COMMENT_CREATE_MAX_BODY_LENGTH} characters.`,
  );

export const issueCommentCreateInputSchema = z.object({
  owner: githubSlugSchema,
  repo: githubSlugSchema,
  issueNumber: z.coerce.number().pipe(issueNumberSchema),
  body: issueCommentCreateBodySchema,
});

export type IssueCommentCreateInput = z.infer<
  typeof issueCommentCreateInputSchema
>;

export const issueCommentCreateInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["owner", "repo", "issueNumber", "body"],
  properties: {
    owner: {
      type: "string",
      minLength: 1,
      maxLength: 100,
      description: "GitHub repository owner (user or organization login).",
    },
    repo: {
      type: "string",
      minLength: 1,
      maxLength: 100,
      description: "GitHub repository name.",
    },
    issueNumber: {
      type: "integer",
      minimum: 1,
      description: "GitHub issue number (not a pull request).",
    },
    body: {
      type: "string",
      minLength: 1,
      maxLength: ISSUE_COMMENT_CREATE_MAX_BODY_LENGTH,
      description: "Comment body (Markdown).",
    },
  },
} satisfies DefineToolOptions["inputSchema"];

export const issueCommentCreateOutputSchema = z.object({
  id: z.number().int().positive(),
  issueNumber: z.number().int().positive(),
  body: z.string().max(OUTPUT_MAX_COMMENT_BODY),
  bodyTruncated: z.boolean().optional(),
  htmlUrl: z.string().url().max(OUTPUT_MAX_URL),
  createdAt: z.string().max(OUTPUT_MAX_ISO_TIMESTAMP),
  authorLogin: z.string().max(OUTPUT_MAX_GITHUB_LOGIN).nullable(),
  authorLoginTruncated: z.boolean().optional(),
});

export type IssueCommentCreateOutput = z.infer<
  typeof issueCommentCreateOutputSchema
>;
