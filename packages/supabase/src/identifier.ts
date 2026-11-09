import { z } from "zod";

import {
  MAX_COLUMN_NAME_LENGTH,
  MAX_SCHEMA_NAME_LENGTH,
  MAX_TABLE_NAME_LENGTH,
} from "./constants.js";

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const schemaNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_SCHEMA_NAME_LENGTH)
  .refine((value) => identifierPattern.test(value), {
    message: "Invalid schema name.",
  });

export const tableNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_TABLE_NAME_LENGTH)
  .refine((value) => identifierPattern.test(value), {
    message: "Invalid table name.",
  });

export const columnNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_COLUMN_NAME_LENGTH)
  .refine((value) => identifierPattern.test(value), {
    message: "Invalid column name.",
  });
