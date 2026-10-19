import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import {
  MAX_HTTP_RESPONSE_BYTES,
  READ_ONLY_GRAPHQL_MAX_RETRIES,
  READ_ONLY_GRAPHQL_RETRY_DELAY_MS,
} from "./constants.js";
import {
  INVENTORY_LEVELS_BY_ITEM_QUERY,
  INVENTORY_LEVELS_BY_LOCATION_QUERY,
  LOCATION_LIST_QUERY,
  ORDER_GET_QUERY,
  ORDER_LIST_QUERY,
  PRODUCT_GET_QUERY,
  PRODUCT_LIST_QUERY,
  SHOP_GET_QUERY,
} from "./graphql/queries.js";
import type { ShopifyClient, ShopifyGraphqlRequest } from "./shopify-client.js";

export interface ShopifyGraphqlHttpError {
  readonly kind: "http";
  readonly status: number;
}

export interface ShopifyGraphqlError {
  readonly kind: "graphql";
  readonly messages: readonly string[];
  readonly throttled?: boolean;
}

interface GraphqlEnvelope<TData> {
  readonly data?: TData;
  readonly errors?: ReadonlyArray<{
    readonly message?: string;
    readonly extensions?: { readonly code?: string };
  }>;
  readonly extensions?: {
    readonly cost?: {
      readonly throttleStatus?: {
        readonly currentlyAvailable?: number;
      };
    };
  };
}

export interface CreateShopifyGraphqlClientOptions {
  readonly graphqlEndpoint: string;
  readonly accessToken: string;
  readonly requestTimeoutMs: number;
  readonly fetchImpl?: typeof fetch;
}

async function readBoundedResponseText(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader !== null) {
    const declared = Number(lengthHeader);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Shopify response exceeds the connector size limit.",
      );
    }
  }

  if (response.body === null) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value === undefined) {
      continue;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ConnectorSdkError(
        "PROVIDER_ERROR",
        "Shopify response exceeds the connector size limit.",
      );
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

function extractGraphqlMessages(
  envelope: GraphqlEnvelope<unknown>,
): readonly string[] {
  if (envelope.errors === undefined) {
    return [];
  }
  return envelope.errors
    .map((entry) => entry.message)
    .filter((message): message is string => typeof message === "string");
}

function envelopeIndicatesThrottle(
  envelope: GraphqlEnvelope<unknown>,
): boolean {
  if (envelope.errors !== undefined) {
    for (const entry of envelope.errors) {
      const code = entry.extensions?.code;
      if (typeof code === "string" && code.toUpperCase() === "THROTTLED") {
        return true;
      }
    }
  }
  const messages = extractGraphqlMessages(envelope).join(" ").toLowerCase();
  if (messages.includes("throttled")) {
    return true;
  }
  const available =
    envelope.extensions?.cost?.throttleStatus?.currentlyAvailable;
  return available !== undefined && available <= 0;
}

function isRetryableTransportError(error: unknown): boolean {
  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as ShopifyGraphqlHttpError).kind === "http"
  ) {
    const status = (error as ShopifyGraphqlHttpError).status;
    return status === 429 || status >= 500;
  }
  if (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    (error as ShopifyGraphqlError).kind === "graphql"
  ) {
    return (error as ShopifyGraphqlError).throttled === true;
  }
  return false;
}

function sleepMs(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function createShopifyGraphqlClient(
  options: CreateShopifyGraphqlClientOptions,
): ShopifyClient {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function executeGraphqlAttempt<TData>(
    request: ShopifyGraphqlRequest,
    attemptTimeoutMs: number,
  ): Promise<TData> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Shopify request timed out."));
    }, attemptTimeoutMs);

    const onAbort = (): void => {
      controller.abort(request.signal?.reason);
    };
    if (request.signal !== undefined) {
      if (request.signal.aborted) {
        clearTimeout(timeout);
        throw new DOMException("Aborted", "AbortError");
      }
      request.signal.addEventListener("abort", onAbort, { once: true });
    }

    try {
      const response = await fetchImpl(options.graphqlEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Shopify-Access-Token": options.accessToken,
        },
        body: JSON.stringify({
          query: request.query,
          ...(request.variables !== undefined
            ? { variables: request.variables }
            : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const httpError: ShopifyGraphqlHttpError = {
          kind: "http",
          status: response.status,
        };
        throw httpError;
      }

      let rawText: string;
      try {
        rawText = await readBoundedResponseText(
          response,
          MAX_HTTP_RESPONSE_BYTES,
        );
      } catch (error) {
        if (error instanceof ConnectorSdkError) {
          throw error;
        }
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Failed to read Shopify response.",
        );
      }

      let envelope: GraphqlEnvelope<TData>;
      try {
        envelope = JSON.parse(rawText) as GraphqlEnvelope<TData>;
      } catch {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Shopify returned invalid JSON.",
        );
      }

      const messages = extractGraphqlMessages(envelope);
      if (messages.length > 0 && envelope.data === undefined) {
        const gqlError: ShopifyGraphqlError = {
          kind: "graphql",
          messages,
          ...(envelopeIndicatesThrottle(envelope) ? { throttled: true } : {}),
        };
        throw gqlError;
      }

      if (envelope.data === undefined) {
        throw new ConnectorSdkError(
          "PROVIDER_ERROR",
          "Shopify returned an empty GraphQL payload.",
        );
      }

      if (messages.length > 0) {
        const gqlError: ShopifyGraphqlError = {
          kind: "graphql",
          messages,
          ...(envelopeIndicatesThrottle(envelope) ? { throttled: true } : {}),
        };
        throw gqlError;
      }

      return envelope.data;
    } finally {
      clearTimeout(timeout);
      if (request.signal !== undefined) {
        request.signal.removeEventListener("abort", onAbort);
      }
    }
  }

  async function executeGraphql<TData>(
    request: ShopifyGraphqlRequest,
  ): Promise<TData> {
    const deadlineMs = Date.now() + options.requestTimeoutMs;
    let attempt = 0;

    for (;;) {
      if (request.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const remainingMs = deadlineMs - Date.now();
      if (remainingMs <= 0) {
        throw new Error("Shopify request timed out.");
      }

      try {
        return await executeGraphqlAttempt<TData>(request, remainingMs);
      } catch (error) {
        const canRetry =
          isRetryableTransportError(error) &&
          attempt < READ_ONLY_GRAPHQL_MAX_RETRIES;
        if (!canRetry) {
          throw error;
        }
        attempt += 1;
        const delayMs = Math.min(
          READ_ONLY_GRAPHQL_RETRY_DELAY_MS,
          deadlineMs - Date.now(),
        );
        if (delayMs <= 0) {
          throw error;
        }
        await sleepMs(delayMs, request.signal);
      }
    }
  }

  return {
    executeGraphql,

    getShop({ signal }) {
      return executeGraphql({ query: SHOP_GET_QUERY, signal });
    },

    listProducts({ limit, cursor, query, signal }) {
      return executeGraphql({
        query: PRODUCT_LIST_QUERY,
        variables: {
          first: limit,
          ...(cursor !== undefined ? { after: cursor } : {}),
          ...(query !== undefined ? { query } : {}),
        },
        signal,
      });
    },

    getProduct({ id, signal }) {
      return executeGraphql({
        query: PRODUCT_GET_QUERY,
        variables: { id },
        signal,
      });
    },

    listOrders({ limit, cursor, query, signal }) {
      return executeGraphql({
        query: ORDER_LIST_QUERY,
        variables: {
          first: limit,
          ...(cursor !== undefined ? { after: cursor } : {}),
          ...(query !== undefined ? { query } : {}),
        },
        signal,
      });
    },

    getOrder({ id, signal }) {
      return executeGraphql({
        query: ORDER_GET_QUERY,
        variables: { id },
        signal,
      });
    },

    listLocations({ limit, cursor, signal }) {
      return executeGraphql({
        query: LOCATION_LIST_QUERY,
        variables: {
          first: limit,
          ...(cursor !== undefined ? { after: cursor } : {}),
        },
        signal,
      });
    },

    listInventoryLevels({
      locationId,
      inventoryItemId,
      limit,
      cursor,
      signal,
    }) {
      if (locationId !== undefined) {
        return executeGraphql({
          query: INVENTORY_LEVELS_BY_LOCATION_QUERY,
          variables: {
            locationId,
            first: limit,
            ...(cursor !== undefined ? { after: cursor } : {}),
          },
          signal,
        });
      }
      if (inventoryItemId !== undefined) {
        return executeGraphql({
          query: INVENTORY_LEVELS_BY_ITEM_QUERY,
          variables: {
            inventoryItemId,
            first: limit,
            ...(cursor !== undefined ? { after: cursor } : {}),
          },
          signal,
        });
      }
      throw new ConnectorSdkError(
        "INVALID_INPUT",
        "Provide locationId or inventoryItemId to list inventory levels.",
      );
    },
  };
}
