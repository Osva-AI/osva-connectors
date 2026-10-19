export const FIXTURE_SCHEMAS = ["app", "analytics"] as const;

export const FIXTURE_TABLES = [
  { schema: "app", name: "users", kind: "table" },
  { schema: "app", name: "events_view", kind: "view" },
  { schema: "app", name: "metrics_mv", kind: "materialized_view" },
] as const;

export const FIXTURE_COLUMNS = [
  {
    name: "id",
    data_type: "integer",
    nullable: false,
    ordinal_position: 1,
  },
  {
    name: "email",
    data_type: "character varying(255)",
    nullable: true,
    ordinal_position: 2,
  },
] as const;
