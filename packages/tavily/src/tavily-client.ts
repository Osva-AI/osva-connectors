export interface TavilySearchParams {
  readonly query: string;
  readonly maxResults?: number;
  readonly searchDepth?: "basic" | "fast" | "ultra-fast";
  readonly topic?: "general" | "news" | "finance";
  readonly includeAnswer?: boolean;
  readonly signal?: AbortSignal;
}

export interface TavilyExtractParams {
  readonly urls: readonly string[];
  readonly extractDepth?: "basic" | "advanced";
  readonly format?: "markdown" | "text";
  readonly signal?: AbortSignal;
}

export interface TavilyCrawlParams {
  readonly url: string;
  readonly maxDepth: number;
  readonly limit: number;
  readonly maxBreadth: number;
  readonly instructions?: string;
  readonly format?: "markdown" | "text";
  readonly signal?: AbortSignal;
}

export interface TavilyClient {
  search(params: TavilySearchParams): Promise<unknown>;
  extract(params: TavilyExtractParams): Promise<unknown>;
  crawl(params: TavilyCrawlParams): Promise<unknown>;
}
