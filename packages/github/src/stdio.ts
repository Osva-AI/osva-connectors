#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadGithubConfig } from "./config.js";
import { createGithubConnector } from "./connector.js";
import { createOctokitRepositoryClient } from "./octokit-client.js";

const config = loadGithubConfig(process.env);
const client = createOctokitRepositoryClient({ token: config.token });
const connector = createGithubConnector({ client });

await serveStdio(connector);
