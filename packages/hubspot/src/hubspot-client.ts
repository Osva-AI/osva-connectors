import type { CrmObjectType } from "./property-allowlist.js";

export interface HubspotListParams {
  readonly pageSize: number;
  readonly pageCursor?: string;
  readonly properties: readonly string[];
  readonly signal?: AbortSignal;
}

export interface HubspotGetObjectParams {
  readonly id: string;
  readonly properties: readonly string[];
  readonly signal?: AbortSignal;
}

export interface HubspotSearchParams {
  readonly objectType: CrmObjectType;
  readonly body: Record<string, unknown>;
  readonly signal?: AbortSignal;
}

export interface HubspotAssociationListParams {
  readonly fromObjectType: CrmObjectType;
  readonly fromObjectId: string;
  readonly toObjectType: CrmObjectType;
  readonly pageSize: number;
  readonly pageCursor?: string;
  readonly signal?: AbortSignal;
}

export interface HubspotClient {
  listCrmObjects(
    objectType: CrmObjectType,
    params: HubspotListParams,
  ): Promise<unknown>;

  getCrmObject(
    objectType: CrmObjectType,
    params: HubspotGetObjectParams,
  ): Promise<unknown>;

  searchCrmObjects(params: HubspotSearchParams): Promise<unknown>;

  listDealPipelines(params: {
    readonly signal?: AbortSignal;
  }): Promise<unknown>;

  listOwners(params: HubspotListParams): Promise<unknown>;

  listAssociations(params: HubspotAssociationListParams): Promise<unknown>;
}
