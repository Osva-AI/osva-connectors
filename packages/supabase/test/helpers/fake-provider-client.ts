import type { OpenApiCatalog } from "../../src/openapi-catalog.js";
import type {
  CountRowsParams,
  SelectRowsParams,
  SelectRowsResult,
  SupabaseProviderClient,
} from "../../src/provider-client.js";

const SAMPLE_CATALOG: OpenApiCatalog = {
  tables: [
    {
      schema: "public",
      name: "users",
      columns: [
        { name: "id", dataType: "uuid", required: true },
        { name: "email", dataType: "text", required: true },
        { name: "name", dataType: "text", required: false },
      ],
    },
    {
      schema: "public",
      name: "orders",
      columns: [
        { name: "id", dataType: "bigint", required: true },
        { name: "user_id", dataType: "uuid", required: true },
      ],
    },
  ],
};

export class FakeSupabaseProviderClient implements SupabaseProviderClient {
  readonly selectCalls: SelectRowsParams[] = [];
  readonly countCalls: CountRowsParams[] = [];

  async getOpenApiCatalog(): Promise<OpenApiCatalog> {
    return SAMPLE_CATALOG;
  }

  async selectRows(params: SelectRowsParams): Promise<SelectRowsResult> {
    this.selectCalls.push(params);
    const rows =
      params.table === "users"
        ? [
            { id: "1", email: "a@example.com", name: "Ada" },
            { id: "2", email: "b@example.com", name: "Bob" },
          ].map((row) => {
            const out: Record<string, unknown> = {};
            for (const column of params.columns) {
              out[column] = row[column as keyof typeof row];
            }
            return out;
          })
        : [];
    const slice = rows.slice(params.offset, params.offset + params.limit);
    return {
      rows: slice,
      rangeStart: params.offset,
      rangeEnd: params.offset + slice.length - 1,
      total: rows.length,
    };
  }

  async countRows(params: CountRowsParams): Promise<number> {
    this.countCalls.push(params);
    return 2;
  }
}
