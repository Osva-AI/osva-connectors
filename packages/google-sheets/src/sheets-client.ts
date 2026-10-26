export interface SheetsGetSpreadsheetParams {
  readonly spreadsheetId: string;
  readonly signal?: AbortSignal;
}

export interface SheetsListSheetsParams {
  readonly spreadsheetId: string;
  readonly signal?: AbortSignal;
}

export interface SheetsGetValuesParams {
  readonly spreadsheetId: string;
  readonly range: string;
  readonly valueRenderOption?: string;
  readonly signal?: AbortSignal;
}

export interface SheetsBatchGetValuesParams {
  readonly spreadsheetId: string;
  readonly ranges: readonly string[];
  readonly valueRenderOption?: string;
  readonly signal?: AbortSignal;
}

export interface SheetsAppendValuesParams {
  readonly spreadsheetId: string;
  readonly range: string;
  readonly values: readonly (readonly string[])[];
  readonly signal?: AbortSignal;
}

export interface SheetsUpdateValuesParams {
  readonly spreadsheetId: string;
  readonly range: string;
  readonly values: readonly (readonly string[])[];
  readonly signal?: AbortSignal;
}

export interface SheetsBatchUpdateValuesParams {
  readonly spreadsheetId: string;
  readonly data: readonly {
    readonly range: string;
    readonly values: readonly (readonly string[])[];
  }[];
  readonly signal?: AbortSignal;
}

export interface SheetsAddSheetParams {
  readonly spreadsheetId: string;
  readonly title: string;
  readonly rowCount?: number;
  readonly columnCount?: number;
  readonly signal?: AbortSignal;
}

export interface SheetsClient {
  getSpreadsheet(params: SheetsGetSpreadsheetParams): Promise<unknown>;
  listSheets(params: SheetsListSheetsParams): Promise<unknown>;
  getValues(params: SheetsGetValuesParams): Promise<unknown>;
  batchGetValues(params: SheetsBatchGetValuesParams): Promise<unknown>;
  appendValues(params: SheetsAppendValuesParams): Promise<unknown>;
  updateValues(params: SheetsUpdateValuesParams): Promise<unknown>;
  batchUpdateValues(params: SheetsBatchUpdateValuesParams): Promise<unknown>;
  addSheet(params: SheetsAddSheetParams): Promise<unknown>;
}
