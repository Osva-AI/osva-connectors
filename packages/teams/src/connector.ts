import {
  ConnectorSdkError,
  defineConnector,
  defineTool,
  type DefinedConnector,
} from "@osva-ai/connector-sdk";

import {
  CONNECTOR_KEY,
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  LIST_MAX_PAGE_SIZE,
  TEAMS_CHANNEL_LIST_TOOL,
  TEAMS_CHANNEL_MESSAGE_LIST_TOOL,
  TEAMS_CHANNEL_MESSAGE_SEND_TOOL,
  TEAMS_CHANNEL_REPLY_LIST_TOOL,
  TEAMS_CHAT_LIST_TOOL,
  TEAMS_CHAT_MESSAGE_LIST_TOOL,
  TEAMS_CHAT_MESSAGE_SEND_TOOL,
  TEAMS_TEAM_LIST_TOOL,
} from "./constants.js";
import {
  TEAMS_NEXT_LINK_SCOPES,
  validateTeamsNextLinkInput,
} from "./graph-pagination.js";
import { mapTeamsError } from "./map-teams-error.js";
import {
  mapChannelListResponse,
  mapChatListResponse,
  mapMessageListResponse,
  mapSendMessageResponse,
  mapTeamListResponse,
} from "./normalize-teams.js";
import {
  assertStructuredOutputWithinBudget,
  packListWithinOutputBudget,
} from "./output-budget.js";
import {
  assertIdAllowed,
  createIdAllowlist,
  filterByIdAllowlist,
} from "./resource-allowlist.js";
import type { TeamsConfig } from "./schemas.js";
import {
  assertChannelDestinationAllowed,
  assertChatDestinationAllowed,
  assertSendEnabledAndApproved,
  buildGraphMessageBody,
} from "./send-policy.js";
import type { TeamsClient } from "./teams-client.js";
import {
  channelListInputJsonSchema,
  channelListInputSchema,
  channelMessageListInputJsonSchema,
  channelMessageListInputSchema,
  channelMessageSendInputJsonSchema,
  channelMessageSendInputSchema,
  channelReplyListInputJsonSchema,
  channelReplyListInputSchema,
  chatListInputJsonSchema,
  chatListInputSchema,
  chatMessageListInputJsonSchema,
  chatMessageListInputSchema,
  chatMessageSendInputJsonSchema,
  chatMessageSendInputSchema,
  teamListInputJsonSchema,
  teamListInputSchema,
} from "./tool-schemas.js";

export interface CreateTeamsConnectorOptions {
  readonly client: TeamsClient;
  readonly config: TeamsConfig;
  readonly accessTokenForRedaction?: string;
}

function invalidInputError(): ConnectorSdkError {
  return new ConnectorSdkError("INVALID_INPUT", "Invalid tool input.");
}

function mapError(
  error: unknown,
  accessTokenForRedaction?: string,
  ambiguousMutation?: boolean,
): ConnectorSdkError {
  return mapTeamsError(error, {
    ...(accessTokenForRedaction !== undefined
      ? { accessToken: accessTokenForRedaction }
      : {}),
    ...(ambiguousMutation === true ? { ambiguousMutation: true } : {}),
  });
}

export function createTeamsConnector(
  options: CreateTeamsConnectorOptions,
): DefinedConnector {
  const config = options.config;
  const redact = options.accessTokenForRedaction;
  const graphBase = config.graphApiBase;

  const teamAllowlist = createIdAllowlist(config.allowedTeamIds);
  const channelAllowlist = createIdAllowlist(config.allowedChannelIds);
  const chatAllowlist = createIdAllowlist(config.allowedChatIds);

  return defineConnector({
    key: CONNECTOR_KEY,
    name: CONNECTOR_NAME,
    version: CONNECTOR_VERSION,
    description:
      "Microsoft Teams MCP connector for OSVA Connector Profile V1: bounded delegated Graph reads for joined teams, channels, chats, and messages; controlled channel and chat sends when explicitly enabled and host-approved. Message HTML and text are untrusted external content. v1 supports delegated user tokens only (no app-only / application permissions for sending). Hosts may restrict reads with OSVA_CONNECTOR_TEAMS_ALLOWED_TEAM_IDS, OSVA_CONNECTOR_TEAMS_ALLOWED_CHANNEL_IDS, and OSVA_CONNECTOR_TEAMS_ALLOWED_CHAT_IDS.",
    tools: [
      defineTool({
        name: TEAMS_TEAM_LIST_TOOL,
        description:
          "Lists Microsoft Teams the signed-in user has joined (GET /me/joinedTeams) with bounded pagination. Filtered when OSVA_CONNECTOR_TEAMS_ALLOWED_TEAM_IDS is set.",
        inputSchema: teamListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = teamListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const nextLink = validateTeamsNextLinkInput(
              parsed.data.nextLink,
              graphBase,
              TEAMS_NEXT_LINK_SCOPES.joinedTeams,
            );
            const pageSize = Math.min(parsed.data.pageSize, LIST_MAX_PAGE_SIZE);
            const raw = await options.client.listJoinedTeams({
              pageSize,
              ...(nextLink !== undefined ? { nextLink } : {}),
              signal: context.signal,
            });
            const mapped = mapTeamListResponse(raw, graphBase);
            const filtered = filterByIdAllowlist(
              teamAllowlist,
              mapped.teams,
              (t) => t.id,
            );
            const envelope = {
              ...(mapped.nextLink !== undefined
                ? { nextLink: mapped.nextLink }
                : {}),
              untrustedContent: true as const,
            };
            const packed = packListWithinOutputBudget(
              envelope,
              "teams",
              filtered,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: TEAMS_CHANNEL_LIST_TOOL,
        description:
          "Lists channels in a team (GET /teams/{team-id}/channels) with bounded pagination.",
        inputSchema: channelListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = channelListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertIdAllowed(teamAllowlist, parsed.data.teamId, "Team ID");
            const nextLink = validateTeamsNextLinkInput(
              parsed.data.nextLink,
              graphBase,
              TEAMS_NEXT_LINK_SCOPES.channels,
            );
            const pageSize = Math.min(parsed.data.pageSize, LIST_MAX_PAGE_SIZE);
            const raw = await options.client.listTeamChannels({
              teamId: parsed.data.teamId,
              pageSize,
              ...(nextLink !== undefined ? { nextLink } : {}),
              signal: context.signal,
            });
            const mapped = mapChannelListResponse(raw, graphBase);
            const filtered = filterByIdAllowlist(
              channelAllowlist,
              mapped.channels,
              (c) => c.id,
            );
            const envelope = {
              teamId: parsed.data.teamId,
              ...(mapped.nextLink !== undefined
                ? { nextLink: mapped.nextLink }
                : {}),
              untrustedContent: true as const,
            };
            const packed = packListWithinOutputBudget(
              envelope,
              "channels",
              filtered,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: TEAMS_CHANNEL_MESSAGE_LIST_TOOL,
        description:
          "Lists messages in a team channel (GET .../messages). Message bodies are untrusted.",
        inputSchema: channelMessageListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = channelMessageListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertIdAllowed(teamAllowlist, parsed.data.teamId, "Team ID");
            assertIdAllowed(
              channelAllowlist,
              parsed.data.channelId,
              "Channel ID",
            );
            const nextLink = validateTeamsNextLinkInput(
              parsed.data.nextLink,
              graphBase,
              TEAMS_NEXT_LINK_SCOPES.channelMessages,
            );
            const pageSize = Math.min(parsed.data.pageSize, LIST_MAX_PAGE_SIZE);
            const raw = await options.client.listChannelMessages({
              teamId: parsed.data.teamId,
              channelId: parsed.data.channelId,
              pageSize,
              ...(nextLink !== undefined ? { nextLink } : {}),
              signal: context.signal,
            });
            const mapped = mapMessageListResponse(raw, graphBase);
            const envelope = {
              teamId: parsed.data.teamId,
              channelId: parsed.data.channelId,
              ...(mapped.nextLink !== undefined
                ? { nextLink: mapped.nextLink }
                : {}),
              untrustedContent: true as const,
            };
            const packed = packListWithinOutputBudget(
              envelope,
              "messages",
              mapped.messages,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: TEAMS_CHANNEL_REPLY_LIST_TOOL,
        description:
          "Lists replies to a channel message (GET .../replies). Untrusted content.",
        inputSchema: channelReplyListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = channelReplyListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertIdAllowed(teamAllowlist, parsed.data.teamId, "Team ID");
            assertIdAllowed(
              channelAllowlist,
              parsed.data.channelId,
              "Channel ID",
            );
            const nextLink = validateTeamsNextLinkInput(
              parsed.data.nextLink,
              graphBase,
              TEAMS_NEXT_LINK_SCOPES.channelReplies,
            );
            const pageSize = Math.min(parsed.data.pageSize, LIST_MAX_PAGE_SIZE);
            const raw = await options.client.listChannelMessageReplies({
              teamId: parsed.data.teamId,
              channelId: parsed.data.channelId,
              messageId: parsed.data.messageId,
              pageSize,
              ...(nextLink !== undefined ? { nextLink } : {}),
              signal: context.signal,
            });
            const mapped = mapMessageListResponse(raw, graphBase);
            const envelope = {
              teamId: parsed.data.teamId,
              channelId: parsed.data.channelId,
              messageId: parsed.data.messageId,
              ...(mapped.nextLink !== undefined
                ? { nextLink: mapped.nextLink }
                : {}),
              untrustedContent: true as const,
            };
            const packed = packListWithinOutputBudget(
              envelope,
              "replies",
              mapped.messages,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: TEAMS_CHAT_LIST_TOOL,
        description:
          "Lists chats for the signed-in user (GET /me/chats) with bounded pagination.",
        inputSchema: chatListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = chatListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            const nextLink = validateTeamsNextLinkInput(
              parsed.data.nextLink,
              graphBase,
              TEAMS_NEXT_LINK_SCOPES.chats,
            );
            const pageSize = Math.min(parsed.data.pageSize, LIST_MAX_PAGE_SIZE);
            const raw = await options.client.listChats({
              pageSize,
              ...(nextLink !== undefined ? { nextLink } : {}),
              signal: context.signal,
            });
            const mapped = mapChatListResponse(raw, graphBase);
            const filtered = filterByIdAllowlist(
              chatAllowlist,
              mapped.chats,
              (c) => c.id,
            );
            const envelope = {
              ...(mapped.nextLink !== undefined
                ? { nextLink: mapped.nextLink }
                : {}),
              untrustedContent: true as const,
            };
            const packed = packListWithinOutputBudget(
              envelope,
              "chats",
              filtered,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: TEAMS_CHAT_MESSAGE_LIST_TOOL,
        description:
          "Lists messages in a chat (GET /me/chats/{chat-id}/messages). Untrusted content.",
        inputSchema: chatMessageListInputJsonSchema,
        handler: async (input, context) => {
          const parsed = chatMessageListInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          try {
            assertIdAllowed(chatAllowlist, parsed.data.chatId, "Chat ID");
            const nextLink = validateTeamsNextLinkInput(
              parsed.data.nextLink,
              graphBase,
              TEAMS_NEXT_LINK_SCOPES.chatMessages,
            );
            const pageSize = Math.min(parsed.data.pageSize, LIST_MAX_PAGE_SIZE);
            const raw = await options.client.listChatMessages({
              chatId: parsed.data.chatId,
              pageSize,
              ...(nextLink !== undefined ? { nextLink } : {}),
              signal: context.signal,
            });
            const mapped = mapMessageListResponse(raw, graphBase);
            const envelope = {
              chatId: parsed.data.chatId,
              ...(mapped.nextLink !== undefined
                ? { nextLink: mapped.nextLink }
                : {}),
              untrustedContent: true as const,
            };
            const packed = packListWithinOutputBudget(
              envelope,
              "messages",
              mapped.messages,
            );
            assertStructuredOutputWithinBudget(packed);
            return packed;
          } catch (error) {
            throw mapError(error, redact);
          }
        },
      }),

      defineTool({
        name: TEAMS_CHANNEL_MESSAGE_SEND_TOOL,
        description:
          "Posts a message to a team channel (POST .../messages). HTML content is treated as untrusted. Requires send flags and destination allowlist. No connector-level retries.",
        inputSchema: channelMessageSendInputJsonSchema,
        handler: async (input, context) => {
          const parsed = channelMessageSendInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertSendEnabledAndApproved(config);
          assertIdAllowed(teamAllowlist, parsed.data.teamId, "Team ID");
          assertIdAllowed(
            channelAllowlist,
            parsed.data.channelId,
            "Channel ID",
          );
          assertChannelDestinationAllowed(
            parsed.data.teamId,
            parsed.data.channelId,
            config,
          );
          try {
            const body = buildGraphMessageBody({
              content: parsed.data.content,
              contentType: parsed.data.contentType,
            });
            const raw = await options.client.sendChannelMessage({
              teamId: parsed.data.teamId,
              channelId: parsed.data.channelId,
              body,
              signal: context.signal,
            });
            const output = mapSendMessageResponse(raw);
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redact, true);
          }
        },
      }),

      defineTool({
        name: TEAMS_CHAT_MESSAGE_SEND_TOOL,
        description:
          "Posts a message to a chat (POST /chats/{chat-id}/messages). Requires send flags and chat destination allowlist. No connector-level retries.",
        inputSchema: chatMessageSendInputJsonSchema,
        handler: async (input, context) => {
          const parsed = chatMessageSendInputSchema.safeParse(input);
          if (!parsed.success) {
            throw invalidInputError();
          }
          assertSendEnabledAndApproved(config);
          assertIdAllowed(chatAllowlist, parsed.data.chatId, "Chat ID");
          assertChatDestinationAllowed(parsed.data.chatId, config);
          try {
            const body = buildGraphMessageBody({
              content: parsed.data.content,
              contentType: parsed.data.contentType,
            });
            const raw = await options.client.sendChatMessage({
              chatId: parsed.data.chatId,
              body,
              signal: context.signal,
            });
            const output = mapSendMessageResponse(raw);
            assertStructuredOutputWithinBudget(output);
            return output;
          } catch (error) {
            throw mapError(error, redact, true);
          }
        },
      }),
    ],
  });
}
