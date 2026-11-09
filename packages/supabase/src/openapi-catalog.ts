import { ConnectorSdkError } from "@osva-ai/connector-sdk";

export interface CatalogColumn {
  readonly name: string;
  readonly dataType: string;
  readonly required: boolean;
}

export interface CatalogTable {
  readonly schema: string;
  readonly name: string;
  readonly columns: readonly CatalogColumn[];
}

export interface OpenApiCatalog {
  readonly tables: readonly CatalogTable[];
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | undefined {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return undefined;
}

function readSchemaProperties(
  schema: JsonRecord | undefined,
): Record<string, JsonRecord> | undefined {
  if (schema === undefined) {
    return undefined;
  }
  const properties = schema.properties;
  if (typeof properties === "object" && properties !== null) {
    return properties as Record<string, JsonRecord>;
  }
  const ref = schema.$ref;
  if (typeof ref === "string") {
    return undefined;
  }
  return undefined;
}

function resolveRef(root: JsonRecord, ref: string): JsonRecord | undefined {
  const prefix = "#/definitions/";
  if (ref.startsWith(prefix)) {
    const name = ref.slice(prefix.length);
    const definitions = root.definitions;
    if (typeof definitions === "object" && definitions !== null) {
      return asRecord((definitions as JsonRecord)[name]);
    }
  }
  const componentsPrefix = "#/components/schemas/";
  if (ref.startsWith(componentsPrefix)) {
    const name = ref.slice(componentsPrefix.length);
    const components = asRecord(root.components);
    const schemas = asRecord(components?.schemas);
    return asRecord(schemas?.[name]);
  }
  return undefined;
}

function resolveSchema(
  root: JsonRecord,
  schema: JsonRecord | undefined,
): JsonRecord | undefined {
  if (schema === undefined) {
    return undefined;
  }
  const ref = schema.$ref;
  if (typeof ref === "string") {
    return resolveRef(root, ref);
  }
  return schema;
}

function mapColumns(
  root: JsonRecord,
  schema: JsonRecord | undefined,
): CatalogColumn[] {
  const resolved = resolveSchema(root, schema);
  const properties = readSchemaProperties(resolved);
  if (properties === undefined) {
    return [];
  }
  const requiredList = Array.isArray(resolved?.required)
    ? (resolved.required as unknown[]).filter(
        (entry): entry is string => typeof entry === "string",
      )
    : [];
  const required = new Set(requiredList);
  const columns: CatalogColumn[] = [];
  for (const [name, definition] of Object.entries(properties)) {
    const def = asRecord(definition) ?? {};
    const typeValue = def.type;
    const formatValue = def.format;
    const dataType =
      typeof formatValue === "string"
        ? formatValue
        : typeof typeValue === "string"
          ? typeValue
          : "unknown";
    columns.push({
      name,
      dataType,
      required: required.has(name),
    });
  }
  return columns.toSorted((a, b) => a.name.localeCompare(b.name));
}

function tableNameFromPath(path: string): string | undefined {
  const trimmed = path.replace(/^\//, "").split("/")[0];
  if (trimmed === undefined || trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.startsWith("rpc")) {
    return undefined;
  }
  return trimmed;
}

export function parseOpenApiCatalog(document: unknown): OpenApiCatalog {
  const root = asRecord(document);
  if (root === undefined) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Supabase OpenAPI payload is invalid.",
    );
  }
  const paths = asRecord(root.paths);
  if (paths === undefined) {
    throw new ConnectorSdkError(
      "PROVIDER_ERROR",
      "Supabase OpenAPI payload is missing paths.",
    );
  }
  const tables: CatalogTable[] = [];
  for (const [path, pathItemRaw] of Object.entries(paths)) {
    const pathItem = asRecord(pathItemRaw);
    if (pathItem === undefined) {
      continue;
    }
    const getOp = asRecord(pathItem.get);
    if (getOp === undefined) {
      continue;
    }
    const tableName = tableNameFromPath(path);
    if (tableName === undefined) {
      continue;
    }
    const schemaTag =
      typeof pathItem["x-db-schema"] === "string"
        ? pathItem["x-db-schema"]
        : typeof getOp["x-db-schema"] === "string"
          ? (getOp["x-db-schema"] as string)
          : "public";
    let columnSchema: JsonRecord | undefined;
    const responses = asRecord(getOp.responses);
    const ok = asRecord(responses?.["200"]);
    const content = asRecord(ok?.content);
    const json = asRecord(content?.["application/json"]);
    const schema = asRecord(json?.schema);
    if (schema !== undefined) {
      const items = asRecord(schema.items);
      columnSchema = resolveSchema(root, items ?? schema);
    }
    if (columnSchema === undefined) {
      const definitions = asRecord(root.definitions);
      const def = asRecord(definitions?.[tableName]);
      columnSchema = def;
    }
    tables.push({
      schema: schemaTag,
      name: tableName,
      columns: mapColumns(root, columnSchema),
    });
  }
  tables.sort((a, b) =>
    a.schema === b.schema
      ? a.name.localeCompare(b.name)
      : a.schema.localeCompare(b.schema),
  );
  return { tables };
}

export function findCatalogTable(
  catalog: OpenApiCatalog,
  schema: string,
  table: string,
): CatalogTable | undefined {
  return catalog.tables.find(
    (entry) => entry.schema === schema && entry.name === table,
  );
}
