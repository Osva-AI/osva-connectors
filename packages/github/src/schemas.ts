import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

import {
  OUTPUT_MAX_BRANCH_NAME,
  OUTPUT_MAX_REPO_DESCRIPTION,
  OUTPUT_MAX_REPO_FULL_NAME,
  OUTPUT_MAX_REPO_NAME,
  OUTPUT_MAX_URL,
} from "./constants.js";

export const githubSlugSchema = z
  .string()
  .trim()
  .min(1, "Value is required.")
  .max(100, "Value must be at most 100 characters.")
  .regex(
    /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$/,
    "Value contains invalid characters.",
  );

export const repositoryGetInputSchema = z.object({
  owner: githubSlugSchema,
  repo: githubSlugSchema,
});

export type RepositoryGetInput = z.infer<typeof repositoryGetInputSchema>;

export const repositoryGetInputJsonSchema = {
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
  },
} satisfies DefineToolOptions["inputSchema"];

export const githubConfigSchema = z.object({
  token: z.string().trim().min(1, "GitHub token must not be empty."),
});

export type GithubConfig = z.infer<typeof githubConfigSchema>;

export const repositoryGetOutputSchema = z.object({
  name: z.string().max(OUTPUT_MAX_REPO_NAME),
  fullName: z.string().max(OUTPUT_MAX_REPO_FULL_NAME),
  description: z.string().max(OUTPUT_MAX_REPO_DESCRIPTION).nullable(),
  descriptionTruncated: z.boolean().optional(),
  htmlUrl: z.string().url().max(OUTPUT_MAX_URL),
  visibility: z.enum(["public", "private", "internal", "unknown"]),
  defaultBranch: z.string().max(OUTPUT_MAX_BRANCH_NAME),
  archived: z.boolean(),
  fork: z.boolean(),
});

export type RepositoryGetOutput = z.infer<typeof repositoryGetOutputSchema>;
