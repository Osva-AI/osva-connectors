import type { DefineToolOptions } from "@osva-ai/connector-sdk";
import { z } from "zod";

const githubSlugSchema = z
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
  name: z.string(),
  fullName: z.string(),
  description: z.string().nullable(),
  htmlUrl: z.string().url(),
  visibility: z.enum(["public", "private", "internal", "unknown"]),
  defaultBranch: z.string(),
  archived: z.boolean(),
  fork: z.boolean(),
});

export type RepositoryGetOutput = z.infer<typeof repositoryGetOutputSchema>;
