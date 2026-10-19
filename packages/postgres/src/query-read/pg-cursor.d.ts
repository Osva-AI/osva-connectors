declare module "pg-cursor" {
  import type { CustomTypesConfig, FieldDef, Submittable } from "pg";

  interface CursorConfig {
    rowMode?: "array" | "object";
    types?: CustomTypesConfig;
  }

  class Cursor extends Submittable {
    constructor(text: string, values?: unknown[], config?: CursorConfig);
    read(rows: number): Promise<unknown[]>;
    close(): Promise<void>;
    _result?: {
      fields?: FieldDef[];
    };
  }

  export = Cursor;
}
