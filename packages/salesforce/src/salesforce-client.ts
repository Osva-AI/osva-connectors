import type {
  AccountListFilters,
  ContactListFilters,
  OpportunityListFilters,
} from "./soql-builder.js";

export interface SalesforceAccountListRequest {
  readonly perPage: number;
  readonly continuationToken?: string;
  readonly filters?: AccountListFilters;
}

export interface SalesforceContactListRequest {
  readonly perPage: number;
  readonly continuationToken?: string;
  readonly filters?: ContactListFilters;
}

export interface SalesforceOpportunityListRequest {
  readonly perPage: number;
  readonly continuationToken?: string;
  readonly filters?: OpportunityListFilters;
}

export interface SalesforceClient {
  listAccounts(
    params: SalesforceAccountListRequest,
    signal?: AbortSignal,
  ): Promise<unknown>;
  getAccount(accountId: string, signal?: AbortSignal): Promise<unknown>;
  listContacts(
    params: SalesforceContactListRequest,
    signal?: AbortSignal,
  ): Promise<unknown>;
  getContact(contactId: string, signal?: AbortSignal): Promise<unknown>;
  listOpportunities(
    params: SalesforceOpportunityListRequest,
    signal?: AbortSignal,
  ): Promise<unknown>;
  getOpportunity(opportunityId: string, signal?: AbortSignal): Promise<unknown>;
  listOpportunityStages(signal?: AbortSignal): Promise<unknown>;
  setOpportunityStage(
    opportunityId: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown>;
  createTask(
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown>;
}
