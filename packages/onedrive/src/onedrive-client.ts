export interface OneDriveGetDriveParams {
  readonly driveId?: string;
  readonly signal?: AbortSignal;
}

export interface OneDriveListChildrenParams {
  readonly itemId?: string;
  readonly driveId?: string;
  readonly pageSize: number;
  readonly nextLink?: string;
  readonly signal?: AbortSignal;
}

export interface OneDriveGetItemParams {
  readonly itemId: string;
  readonly driveId?: string;
  readonly signal?: AbortSignal;
}

export interface OneDriveReadContentParams {
  readonly itemId: string;
  readonly driveId?: string;
  readonly maxBytes: number;
  readonly signal?: AbortSignal;
}

export interface OneDriveSearchParams {
  readonly query: string;
  readonly driveId?: string;
  readonly pageSize: number;
  readonly nextLink?: string;
  readonly signal?: AbortSignal;
}

export interface OneDriveUploadSmallParams {
  readonly parentItemId: string;
  readonly driveId?: string;
  readonly filename: string;
  readonly content: Uint8Array;
  readonly signal?: AbortSignal;
}

export interface OneDriveClient {
  getDrive(params: OneDriveGetDriveParams): Promise<unknown>;
  listChildren(params: OneDriveListChildrenParams): Promise<unknown>;
  getItem(params: OneDriveGetItemParams): Promise<unknown>;
  readItemContent(params: OneDriveReadContentParams): Promise<Uint8Array>;
  searchItems(params: OneDriveSearchParams): Promise<unknown>;
  uploadSmallFile(params: OneDriveUploadSmallParams): Promise<unknown>;
}
