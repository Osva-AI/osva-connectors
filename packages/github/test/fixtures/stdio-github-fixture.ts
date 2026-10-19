#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { serveStdio, type DefinedConnector } from "@osva-ai/connector-sdk";

const TEST_API_BASE_ENV = "OSVA_CONNECTOR_GITHUB_TEST_API_BASE_URL";
const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(FIXTURE_DIR, "..", "..", "..", "dist");

function assertLoopbackApiBase(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Test fixture API base URL is invalid.");
  }
  if (url.protocol !== "http:") {
    throw new Error("Test fixture API base URL must use http.");
  }
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error("Test fixture API base URL must target loopback.");
  }
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

async function loadDistModule<T>(name: string): Promise<T> {
  return (await import(pathToFileURL(path.join(DIST_DIR, name)).href)) as T;
}

const rawBase = process.env[TEST_API_BASE_ENV]?.trim();
if (rawBase === undefined || rawBase.length === 0) {
  throw new Error(
    `Test stdio fixture requires ${TEST_API_BASE_ENV} (loopback GitHub API mock base, including /api/v3).`,
  );
}

const apiBaseUrl = assertLoopbackApiBase(rawBase);

const { loadGithubConfig } = await loadDistModule<{
  loadGithubConfig: (env: NodeJS.ProcessEnv) => { token: string };
}>("config.js");
const { createGithubConnector } = await loadDistModule<{
  createGithubConnector: (options: { client: unknown }) => DefinedConnector;
}>("connector.js");
const { createGithubOctokit, createOctokitGithubClient } =
  await loadDistModule<{
    createGithubOctokit: (options: {
      token: string;
      baseUrl: string;
    }) => unknown;
    createOctokitGithubClient: (options: {
      token: string;
      octokit: unknown;
    }) => {
      getRepository: (input: unknown) => Promise<unknown>;
    };
  }>("octokit-client.js");

const config = loadGithubConfig(process.env);
const octokit = createGithubOctokit({
  token: config.token,
  baseUrl: apiBaseUrl,
});
const client = createOctokitGithubClient({
  token: config.token,
  octokit,
});

await serveStdio(createGithubConnector({ client }));
