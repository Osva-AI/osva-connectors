export interface TeamsListParams {
  readonly signal?: AbortSignal;
  readonly pageSize: number;
  readonly nextLink?: string;
}

export interface TeamsChannelListParams extends TeamsListParams {
  readonly teamId: string;
}

export interface TeamsChannelMessageListParams extends TeamsListParams {
  readonly teamId: string;
  readonly channelId: string;
}

export interface TeamsChannelReplyListParams extends TeamsListParams {
  readonly teamId: string;
  readonly channelId: string;
  readonly messageId: string;
}

export interface TeamsChatMessageListParams extends TeamsListParams {
  readonly chatId: string;
}

export interface TeamsChannelMessageSendParams {
  readonly signal?: AbortSignal;
  readonly teamId: string;
  readonly channelId: string;
  readonly body: unknown;
}

export interface TeamsChatMessageSendParams {
  readonly signal?: AbortSignal;
  readonly chatId: string;
  readonly body: unknown;
}

export interface TeamsClient {
  listJoinedTeams(params: TeamsListParams): Promise<unknown>;
  listTeamChannels(params: TeamsChannelListParams): Promise<unknown>;
  listChannelMessages(params: TeamsChannelMessageListParams): Promise<unknown>;
  listChannelMessageReplies(
    params: TeamsChannelReplyListParams,
  ): Promise<unknown>;
  listChats(params: TeamsListParams): Promise<unknown>;
  listChatMessages(params: TeamsChatMessageListParams): Promise<unknown>;
  sendChannelMessage(params: TeamsChannelMessageSendParams): Promise<unknown>;
  sendChatMessage(params: TeamsChatMessageSendParams): Promise<unknown>;
}
