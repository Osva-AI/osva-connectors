export interface DriveListFilesParams {
  readonly q?: string;
  readonly pageSize: number;
  readonly pageToken?: string;
  readonly orderBy?: string;
  readonly driveId?: string;
  readonly includeSharedDrives?: boolean;
  readonly signal?: AbortSignal;
}

export interface DriveGetFileParams {
  readonly fileId: string;
  readonly signal?: AbortSignal;
}

export interface DriveReadFileMediaParams {
  readonly fileId: string;
  readonly maxBytes: number;
  readonly signal?: AbortSignal;
}

export interface DriveExportFileParams {
  readonly fileId: string;
  readonly mimeType: string;
  readonly maxBytes: number;
  readonly signal?: AbortSignal;
}

export interface DriveListFolderChildrenParams {
  readonly folderId: string;
  readonly pageSize: number;
  readonly pageToken?: string;
  readonly driveId?: string;
  readonly signal?: AbortSignal;
}

export interface DriveListSharedDrivesParams {
  readonly pageSize: number;
  readonly pageToken?: string;
  readonly signal?: AbortSignal;
}

export interface DriveChangesStartParams {
  readonly driveId?: string;
  readonly signal?: AbortSignal;
}

export interface DriveChangesListParams {
  readonly pageToken: string;
  readonly pageSize: number;
  readonly driveId?: string;
  readonly signal?: AbortSignal;
}

export interface DriveClient {
  listFiles(params: DriveListFilesParams): Promise<unknown>;
  getFile(params: DriveGetFileParams): Promise<unknown>;
  readFileMedia(params: DriveReadFileMediaParams): Promise<Uint8Array>;
  exportFile(params: DriveExportFileParams): Promise<Uint8Array>;
  listFolderChildren(params: DriveListFolderChildrenParams): Promise<unknown>;
  listSharedDrives(params: DriveListSharedDrivesParams): Promise<unknown>;
  getChangesStartPageToken(params: DriveChangesStartParams): Promise<unknown>;
  listChanges(params: DriveChangesListParams): Promise<unknown>;
}
