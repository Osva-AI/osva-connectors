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
  HUBSPOT_ASSOCIATION_LIST_TOOL,
  HUBSPOT_COMPANY_GET_TOOL,
  HUBSPOT_COMPANY_LIST_TOOL,
  HUBSPOT_CONTACT_GET_TOOL,
  HUBSPOT_CONTACT_LIST_TOOL,
  HUBSPOT_CRM_SEARCH_TOOL,
  HUBSPOT_DEAL_GET_TOOL,
  HUBSPOT_DEAL_LIST_TOOL,
  HUBSPOT_OWNER_LIST_TOOL,
  HUBSPOT_PIPELINE_LIST_TOOL,
} from "./constants.js";
import { fetchHubspotListBounded } from "./hubspot-list-fetch.js";
import type { HubspotClient } from "./hubspot-client.js";
import { mapHubspotError } from "./map-hubspot-error.js";
import { parseHubspotListResponse } from "./pagination.js";
import {
  mapAssociationListResponse,
  mapCrmObjectGetResponse,
  mapCrmObjectListResponse,
  mapOwnerListResponse,
  mapPipelineListResponse,
} from "./normalize-resources.js";
import {
  assertObjectTypeAllowed,
  resolveApiProperties,
  type CrmObjectType,
} from "./property-allowlist.js";
import { buildHubspotSearchBody } from "./search-filter.js";
import {
  associationListInputJsonSchema,
  associationListInputSchema,
  companyGetInputJsonSchema,
  companyGetInputSchema,
  companyListInputJsonSchema,
  companyListInputSchema,
  contactGetInputJsonSchema,
  contactGetInputSchema,
  contactListInputJsonSchema,
  contactListInputSchema,
  crmSearchInputJsonSchema,
  crmSearchInputSchema,
  dealGetInputJsonSchema,
  dealGetInputSchema,
  dealListInputJsonSchema,
  dealListInputSchema,
  ownerListInputJsonSchema,
  ownerListInputSchema,
  pipelineListInputJsonSchema,
  pipelineListInputSchema,
} from "./tool-schemas.js";

export interface CreateHubspotConnectorOptions {
  readonly client: HubspotClient;
  readonly maxRows?: number;
  readonly allowedObjectTypes?: readonly CrmObjectType[];
  readonly includePii?: boolean;
  readonly accessTokenForRedaction?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  accessTokenForRedaction?: string,
): ConnectorSdkError {
  return mapHubspotError(error, {
    accessToken: accessTokenForRedaction,
  });
}

async function listCrmObjectsTool(
  options: CreateHubspotConnectorOptions,
  objectType: CrmObjectType,
  input: { limit: number; pageCursor?: string },
  signal?: AbortSignal,
): Promise<unknown> {
  const allowedObjectTypes =
    options.allowedObjectTypes ?? (["contacts", "companies", "deals"] as const);
  const includePii = options.includePii ?? false;
  const configuredMaxRows = options.maxRows ?? 100;
  assertObjectTypeAllowed(objectType, allowedObjectTypes);
  const limit = Math.min(input.limit, configuredMaxRows);
  const properties = resolveApiProperties(objectType, includePii);
  const fetched = await fetchHubspotListBounded({
    limit,
    ...(input.pageCursor !== undefined ? { pageCursor: input.pageCursor } : {}),
    signal,
    fetchPage: (pageParams) =>
      options.client.listCrmObjects(objectType, {
        ...pageParams,
        properties,
      }),
  });
  return mapCrmObjectListResponse(objectType, fetched.rows, includePii, {
    ...(fetched.nextCursor !== undefined
      ? { nextCursor: fetched.nextCursor }
      : {}),
    ...(fetched.rowsTruncated ? { rowsTruncated: true } : {}),
  });
}

export function createHubspotConnector(
  options: CreateHubspotConnectorOptions,
): DefinedConnector {
  const configuredMaxRows = options.maxRows ?? 100;
  const allowedObjectTypes =
    options.allowedObjectTypes ?? (["contacts", "companies", "deals"] as const);
  const includePii = options.includePii ?? false;
  const redactionToken = options.accessTokenForRedaction;

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    description:
      "HubSpot read-only connector for OSVA Connector Profile V1 (CRM contacts, companies, deals, structured search, pipelines, owners, and associations). Requires a HubSpot private app access token with CRM read scopes.",
    version: CONNECTOR_VERSION,
    tools: [
      defineTool({
        name: HUBSPOT_CONTACT_LIST_TOOL,
        description:
          "Lists HubSpot contacts with bounded cursor pagination (allowlisted properties; PII minimized unless INCLUDE_PII is enabled).",
        inputSchema: contactListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = contactListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            return await listCrmObjectsTool(
              options,
              "contacts",
              parsed.data,
              context.signal,
            );
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: HUBSPOT_CONTACT_GET_TOOL,
        description:
          "Returns a HubSpot contact by ID (allowlisted properties).",
        inputSchema: contactGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = contactGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertObjectTypeAllowed("contacts", allowedObjectTypes);
          try {
            const raw = await options.client.getCrmObject("contacts", {
              id: parsed.data.contactId,
              properties: resolveApiProperties("contacts", includePii),
              signal: context.signal,
            });
            return mapCrmObjectGetResponse("contacts", raw, includePii);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: HUBSPOT_COMPANY_LIST_TOOL,
        description:
          "Lists HubSpot companies with bounded cursor pagination (allowlisted properties).",
        inputSchema: companyListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = companyListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            return await listCrmObjectsTool(
              options,
              "companies",
              parsed.data,
              context.signal,
            );
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: HUBSPOT_COMPANY_GET_TOOL,
        description:
          "Returns a HubSpot company by ID (allowlisted properties).",
        inputSchema: companyGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = companyGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertObjectTypeAllowed("companies", allowedObjectTypes);
          try {
            const raw = await options.client.getCrmObject("companies", {
              id: parsed.data.companyId,
              properties: resolveApiProperties("companies", includePii),
              signal: context.signal,
            });
            return mapCrmObjectGetResponse("companies", raw, includePii);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: HUBSPOT_DEAL_LIST_TOOL,
        description:
          "Lists HubSpot deals with bounded cursor pagination (allowlisted properties).",
        inputSchema: dealListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = dealListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            return await listCrmObjectsTool(
              options,
              "deals",
              parsed.data,
              context.signal,
            );
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: HUBSPOT_DEAL_GET_TOOL,
        description: "Returns a HubSpot deal by ID (allowlisted properties).",
        inputSchema: dealGetInputJsonSchema,
        handler: async (input, context) => {
          const parsed = dealGetInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertObjectTypeAllowed("deals", allowedObjectTypes);
          try {
            const raw = await options.client.getCrmObject("deals", {
              id: parsed.data.dealId,
              properties: resolveApiProperties("deals", includePii),
              signal: context.signal,
            });
            return mapCrmObjectGetResponse("deals", raw, includePii);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: HUBSPOT_CRM_SEARCH_TOOL,
        description:
          "Runs a structured HubSpot CRM search (POST /crm/objects/2026-09/{type}/search). filterGroups use validated operators (EQ, NEQ, GT, GTE, LT, LTE, IN) on allowlisted properties only.",
        inputSchema: crmSearchInputJsonSchema,
        handler: async (input, context) => {
          const parsed = crmSearchInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const limit = Math.min(parsed.data.limit, configuredMaxRows);
          let searchBody: Record<string, unknown>;
          try {
            searchBody = buildHubspotSearchBody(parsed.data, {
              allowedObjectTypes,
              includePii,
              limit,
              ...(parsed.data.pageCursor !== undefined
                ? { after: parsed.data.pageCursor }
                : {}),
              properties: [
                ...resolveApiProperties(parsed.data.objectType, includePii),
              ],
            });
          } catch (error) {
            if (error instanceof ConnectorSdkError) {
              throw error;
            }
            throw invalidInputError();
          }
          try {
            const raw = await options.client.searchCrmObjects({
              objectType: parsed.data.objectType,
              body: searchBody,
              signal: context.signal,
            });
            const listPayload = parseHubspotListResponse(raw);
            const rows = listPayload.results.slice(0, limit);
            const nextCursor =
              rows.length >= limit && listPayload.nextCursor !== undefined
                ? listPayload.nextCursor
                : undefined;
            return mapCrmObjectListResponse(
              parsed.data.objectType,
              rows,
              includePii,
              {
                ...(nextCursor !== undefined ? { nextCursor } : {}),
                ...(nextCursor !== undefined ? { rowsTruncated: true } : {}),
              },
            );
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: HUBSPOT_PIPELINE_LIST_TOOL,
        description:
          "Lists HubSpot deal pipelines and stages (GET /crm/pipelines/2026-09/deals).",
        inputSchema: pipelineListInputJsonSchema,
        handler: async (_input, context) => {
          const parsed = pipelineListInputSchema.safeParse(_input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const raw = await options.client.listDealPipelines({
              signal: context.signal,
            });
            return mapPipelineListResponse(raw);
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: HUBSPOT_OWNER_LIST_TOOL,
        description:
          "Lists HubSpot CRM owners with bounded pagination (email and names omitted unless INCLUDE_PII is enabled).",
        inputSchema: ownerListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = ownerListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          const limit = Math.min(parsed.data.limit, configuredMaxRows);
          try {
            const fetched = await fetchHubspotListBounded({
              limit,
              ...(parsed.data.pageCursor !== undefined
                ? { pageCursor: parsed.data.pageCursor }
                : {}),
              signal: context.signal,
              fetchPage: (pageParams) =>
                options.client.listOwners({
                  ...pageParams,
                  properties: [],
                }),
            });
            return mapOwnerListResponse(fetched.rows, includePii, {
              ...(fetched.nextCursor !== undefined
                ? { nextCursor: fetched.nextCursor }
                : {}),
              ...(fetched.rowsTruncated ? { rowsTruncated: true } : {}),
            });
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
      defineTool({
        name: HUBSPOT_ASSOCIATION_LIST_TOOL,
        description:
          "Lists associations between CRM records (GET /crm/objects/2026-09/{from}/{id}/associations/{to}).",
        inputSchema: associationListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = associationListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertObjectTypeAllowed(
            parsed.data.fromObjectType,
            allowedObjectTypes,
          );
          assertObjectTypeAllowed(parsed.data.toObjectType, allowedObjectTypes);
          const limit = Math.min(parsed.data.limit, configuredMaxRows);
          try {
            const fetched = await fetchHubspotListBounded({
              limit,
              ...(parsed.data.pageCursor !== undefined
                ? { pageCursor: parsed.data.pageCursor }
                : {}),
              signal: context.signal,
              fetchPage: (pageParams) =>
                options.client.listAssociations({
                  fromObjectType: parsed.data.fromObjectType,
                  fromObjectId: parsed.data.fromObjectId,
                  toObjectType: parsed.data.toObjectType,
                  ...pageParams,
                }),
            });
            return mapAssociationListResponse(fetched.rows, {
              ...(fetched.nextCursor !== undefined
                ? { nextCursor: fetched.nextCursor }
                : {}),
              ...(fetched.rowsTruncated ? { rowsTruncated: true } : {}),
            });
          } catch (error) {
            throw mapError(error, redactionToken);
          }
        },
      }),
    ],
  });
}
