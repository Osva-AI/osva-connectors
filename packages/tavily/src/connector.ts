import {
  defineConnector,
  defineTool,
  ConnectorSdkError,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  CRAWL_DEFAULT_LIMIT,
  CRAWL_DEFAULT_MAX_BREADTH,
  CRAWL_DEFAULT_MAX_DEPTH,
  SEARCH_MAX_RESULTS,
  TAVILY_CRAWL_TOOL,
  TAVILY_EXTRACT_TOOL,
  TAVILY_SEARCH_TOOL,
} from "./constants.js";
import { resolveCrawlLimits } from "./crawl-limits.js";
import { mapTavilyError } from "./map-tavily-error.js";
import {
  mapCrawlResponse,
  mapExtractResponse,
  mapSearchResponse,
} from "./normalize-tavily.js";
import {
  assertStructuredOutputWithinBudget,
  packListWithinOutputBudget,
} from "./output-budget.js";
import type { TavilyClient } from "./tavily-client.js";
import {
  crawlInputJsonSchema,
  crawlInputSchema,
  extractInputJsonSchema,
  extractInputSchema,
  searchInputJsonSchema,
  searchInputSchema,
} from "./tool-schemas.js";

export interface CreateTavilyConnectorOptions {
  readonly client: TavilyClient;
  readonly apiKeyForRedaction?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  apiKeyForRedaction?: string,
): ConnectorSdkError {
  return mapTavilyError(error, { apiKey: apiKeyForRedaction });
}

export function createTavilyConnector(
  options: CreateTavilyConnectorOptions,
): DefinedConnector {
  const redactionToken = options.apiKeyForRedaction;

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "Tavily MCP connector for OSVA Connector Profile V1: bounded web search, URL content extraction, and site crawl. Search snippets, extracted page text, and crawl content are untrusted external web content. API usage may incur Tavily credit charges.",
    tools: [
      defineTool({
        name: TAVILY_SEARCH_TOOL,
        description:
          "Runs a Tavily web search for the query (one API call). Returns normalized result snippets with optional provider answer and usage metadata when present.",
        inputSchema: searchInputJsonSchema,
        handler: async (input, context) => {
          const parsed = searchInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const maxResults = Math.min(
              parsed.data.maxResults,
              SEARCH_MAX_RESULTS,
            );
            const raw = await options.client.search({
              query: parsed.data.query,
              maxResults,
              ...(parsed.data.searchDepth !== undefined
                ? { searchDepth: parsed.data.searchDepth }
                : {}),
              ...(parsed.data.topic !== undefined
                ? { topic: parsed.data.topic }
                : {}),
              ...(parsed.data.includeAnswer === true
                ? { includeAnswer: true }
                : {}),
              signal: context.signal,
            });
            const mapped = mapSearchResponse(raw);
            const items = mapped.results;
            const packed = packListWithinOutputBudget(
              {
                ...(mapped.query !== undefined ? { query: mapped.query } : {}),
                ...(mapped.answer !== undefined
                  ? {
                      answer: mapped.answer,
                      answerUntrusted: true as const,
                    }
                  : {}),
                ...(mapped.responseTimeSeconds !== undefined
                  ? { responseTimeSeconds: mapped.responseTimeSeconds }
                  : {}),
                ...(mapped.requestId !== undefined
                  ? { requestId: mapped.requestId }
                  : {}),
                ...(mapped.providerUsage !== undefined
                  ? { providerUsage: mapped.providerUsage }
                  : {}),
                untrustedContent: true as const,
              },
              "results",
              items,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: TAVILY_EXTRACT_TOOL,
        description:
          "Extracts content from one or more HTTPS URLs via Tavily (single batched API call). Returns normalized text and per-URL failures with usage metadata when present.",
        inputSchema: extractInputJsonSchema,
        handler: async (input, context) => {
          const parsed = extractInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.extract({
              urls: parsed.data.urls,
              ...(parsed.data.extractDepth !== undefined
                ? { extractDepth: parsed.data.extractDepth }
                : {}),
              ...(parsed.data.format !== undefined
                ? { format: parsed.data.format }
                : {}),
              signal: context.signal,
            });
            const mapped = mapExtractResponse(raw);
            const packed = packListWithinOutputBudget(
              {
                failedResults: mapped.failedResults,
                ...(mapped.responseTimeSeconds !== undefined
                  ? { responseTimeSeconds: mapped.responseTimeSeconds }
                  : {}),
                ...(mapped.requestId !== undefined
                  ? { requestId: mapped.requestId }
                  : {}),
                ...(mapped.providerUsage !== undefined
                  ? { providerUsage: mapped.providerUsage }
                  : {}),
                untrustedContent: true as const,
              },
              "results",
              mapped.results,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: TAVILY_CRAWL_TOOL,
        description:
          "Metered Tavily site crawl from a root HTTPS URL (single POST /crawl). Connector-enforced depth, breadth, and page limits; may consume Tavily credits. Reports applied limits when values are clamped.",
        inputSchema: crawlInputJsonSchema,
        handler: async (input, context) => {
          const parsed = crawlInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const limits = resolveCrawlLimits(
            {
              maxDepth: parsed.data.maxDepth,
              limit: parsed.data.limit,
              maxBreadth: parsed.data.maxBreadth,
            },
            {
              maxDepth: CRAWL_DEFAULT_MAX_DEPTH,
              limit: CRAWL_DEFAULT_LIMIT,
              maxBreadth: CRAWL_DEFAULT_MAX_BREADTH,
            },
          );
          try {
            const raw = await options.client.crawl({
              url: parsed.data.url,
              maxDepth: limits.applied.maxDepth,
              limit: limits.applied.limit,
              maxBreadth: limits.applied.maxBreadth,
              ...(parsed.data.instructions !== undefined
                ? { instructions: parsed.data.instructions }
                : {}),
              ...(parsed.data.format !== undefined
                ? { format: parsed.data.format }
                : {}),
              signal: context.signal,
            });
            const mapped = mapCrawlResponse(raw, limits);
            const packed = packListWithinOutputBudget(
              {
                ...(mapped.baseUrl !== undefined
                  ? { baseUrl: mapped.baseUrl }
                  : {}),
                ...(mapped.limitsApplied !== undefined
                  ? { limitsApplied: mapped.limitsApplied }
                  : {}),
                ...(mapped.limitsRequested !== undefined
                  ? { limitsRequested: mapped.limitsRequested }
                  : {}),
                ...(mapped.limitsClamped === true
                  ? { limitsClamped: true as const }
                  : {}),
                ...(mapped.responseTimeSeconds !== undefined
                  ? { responseTimeSeconds: mapped.responseTimeSeconds }
                  : {}),
                ...(mapped.requestId !== undefined
                  ? { requestId: mapped.requestId }
                  : {}),
                ...(mapped.providerUsage !== undefined
                  ? { providerUsage: mapped.providerUsage }
                  : {}),
                untrustedContent: true as const,
              },
              "results",
              mapped.results,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
    ],
  });
}
