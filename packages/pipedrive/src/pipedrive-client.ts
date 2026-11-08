export interface PipedriveListParams {
  readonly limit: number;
  readonly cursor?: string;
}

export interface PipedriveStageListParams extends PipedriveListParams {
  readonly pipelineId?: number;
}

export interface PipedriveClient {
  listPipelines(
    params: PipedriveListParams,
    signal?: AbortSignal,
  ): Promise<unknown>;
  listStages(
    params: PipedriveStageListParams,
    signal?: AbortSignal,
  ): Promise<unknown>;
  listDeals(
    params: PipedriveListParams,
    signal?: AbortSignal,
  ): Promise<{ items: unknown; nextCursor?: string }>;
  getDeal(dealId: number, signal?: AbortSignal): Promise<unknown>;
  searchDeals(
    term: string,
    params: PipedriveListParams,
    signal?: AbortSignal,
  ): Promise<unknown>;
  listPersons(
    params: PipedriveListParams,
    signal?: AbortSignal,
  ): Promise<{ items: unknown; nextCursor?: string }>;
  getPerson(personId: number, signal?: AbortSignal): Promise<unknown>;
  listOrganizations(
    params: PipedriveListParams,
    signal?: AbortSignal,
  ): Promise<{ items: unknown; nextCursor?: string }>;
  getOrganization(
    organizationId: number,
    signal?: AbortSignal,
  ): Promise<unknown>;
  setDealStage(
    dealId: number,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown>;
}
