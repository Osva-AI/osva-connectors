#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadGithubConfig } from "./config.js";
import { createGithubConnector } from "./connector.js";
import { createOctokitGithubClient } from "./octokit-client.js";

const config = loadGithubConfig(process.env);
const client = createOctokitGithubClient({ token: config.token });
const connector = createGithubConnector({ client });

await serveStdio(connector);
