export interface FirecrawlScrapeParams {
  readonly url: string;
  readonly signal?: AbortSignal;
}

export interface FirecrawlSearchParams {
  readonly query: string;
  readonly limit: number;
  readonly signal?: AbortSignal;
}

export interface FirecrawlMapParams {
  readonly url: string;
  readonly limit: number;
  readonly search?: string;
  readonly signal?: AbortSignal;
}

export interface FirecrawlCrawlStartParams {
  readonly url: string;
  readonly limit: number;
  readonly maxDiscoveryDepth: number;
  readonly signal?: AbortSignal;
}

export interface FirecrawlCrawlStatusParams {
  readonly crawlId: string;
  readonly next?: string;
  readonly skip?: number;
  readonly signal?: AbortSignal;
}

export interface FirecrawlClient {
  scrape(params: FirecrawlScrapeParams): Promise<unknown>;

  search(params: FirecrawlSearchParams): Promise<unknown>;

  map(params: FirecrawlMapParams): Promise<unknown>;

  startCrawl(params: FirecrawlCrawlStartParams): Promise<unknown>;

  getCrawlStatus(params: FirecrawlCrawlStatusParams): Promise<unknown>;
}
