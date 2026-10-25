export interface SlackAuthTestResult {
  readonly teamId: string;
  readonly teamName: string;
  readonly botUserId: string;
  readonly botId?: string;
}

export interface SlackChannelSummary {
  readonly id: string;
  readonly name: string;
  readonly isPrivate: boolean;
  readonly isArchived: boolean;
}

export interface SlackChannelInfo extends SlackChannelSummary {
  readonly topic?: string;
  readonly purpose?: string;
  readonly memberCount?: number;
}

export interface SlackMessageRecord {
  readonly ts: string;
  readonly text: string;
  readonly textTruncated?: true;
  readonly userId?: string;
  readonly botId?: string;
  readonly threadTs?: string;
  readonly replyCount?: number;
}

export interface SlackPaginatedMessages {
  readonly messages: readonly SlackMessageRecord[];
  readonly nextCursor?: string;
  readonly hasMore: boolean;
  readonly messagesTruncated?: true;
}

export interface SlackPaginatedChannels {
  readonly channels: readonly SlackChannelSummary[];
  readonly nextCursor?: string;
  readonly hasMore: boolean;
  readonly channelsTruncated?: true;
  readonly allowlistFiltered?: true;
}

export interface SlackPostMessageResult {
  readonly channelId: string;
  readonly ts: string;
  readonly threadTs?: string;
}

export interface SlackClient {
  authTest(params: { signal?: AbortSignal }): Promise<SlackAuthTestResult>;

  listChannels(params: {
    limit: number;
    cursor?: string;
    types?: readonly string[];
    signal?: AbortSignal;
  }): Promise<SlackPaginatedChannels>;

  getChannelInfo(params: {
    channelId: string;
    signal?: AbortSignal;
  }): Promise<SlackChannelInfo>;

  getChannelHistory(params: {
    channelId: string;
    limit: number;
    cursor?: string;
    oldest?: string;
    latest?: string;
    signal?: AbortSignal;
  }): Promise<SlackPaginatedMessages>;

  getThreadReplies(params: {
    channelId: string;
    threadTs: string;
    limit: number;
    cursor?: string;
    signal?: AbortSignal;
  }): Promise<SlackPaginatedMessages>;

  postMessage(params: {
    channelId: string;
    text: string;
    threadTs?: string;
    signal?: AbortSignal;
  }): Promise<SlackPostMessageResult>;
}
