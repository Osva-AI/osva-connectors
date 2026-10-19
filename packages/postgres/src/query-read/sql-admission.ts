import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import {
  astVisitor,
  parse,
  type SelectStatement,
  type Statement,
  type WithStatement,
  type WithStatementBinding,
} from "pgsql-ast-parser";

const SELECT_ROOT_TYPES = new Set([
  "select",
  "union",
  "union all",
  "values",
  "with",
  "with recursive",
]);

function invalidSql(
  message = "SQL is not permitted for read-only execution.",
): never {
  throw new ConnectorSdkError("INVALID_INPUT", message);
}

function normalizeSingleStatementSql(sql: string): string {
  const trimmed = sql.trim();
  if (trimmed.length === 0) {
    invalidSql("SQL must not be empty.");
  }
  return trimmed.replace(/;\s*$/u, "");
}

function assertWithBindingIsSelect(binding: WithStatementBinding): void {
  if (
    binding.type === "insert" ||
    binding.type === "update" ||
    binding.type === "delete"
  ) {
    invalidSql("Data-modifying CTEs are not allowed.");
  }
  assertSelectStatement(binding as SelectStatement);
}

function assertWithStatement(
  statement:
    WithStatement | Extract<SelectStatement, { type: "with recursive" }>,
): void {
  if (statement.type === "with recursive") {
    assertSelectStatement(statement.bind);
    assertWithBindingIsSelect(statement.in);
    return;
  }
  for (const bound of statement.bind) {
    assertWithBindingIsSelect(bound.statement);
  }
  assertWithBindingIsSelect(statement.in);
}

function assertNoSelectInto(normalizedSql: string): void {
  if (/\bINSERT\b/i.test(normalizedSql)) {
    return;
  }
  if (/\bSELECT\b[\s\S]*?\bINTO\b/i.test(normalizedSql)) {
    invalidSql("SELECT INTO is not allowed.");
  }
}

function assertSelectFromStatement(
  statement: Extract<SelectStatement, { type: "select" }>,
): void {
  if (statement.for !== undefined) {
    invalidSql("Locking clauses are not allowed.");
  }
  if (statement.skip !== undefined) {
    invalidSql("Locking clauses are not allowed.");
  }
}

function assertSelectStatement(statement: SelectStatement): void {
  switch (statement.type) {
    case "select":
      assertSelectFromStatement(statement);
      return;
    case "union":
    case "union all":
      assertSelectStatement(statement.left);
      assertSelectStatement(statement.right);
      return;
    case "values":
      return;
    case "with":
      assertWithStatement(statement);
      return;
    case "with recursive":
      assertWithStatement(statement);
      return;
    default:
      invalidSql();
  }
}

function parseParameterIndex(name: string): number | undefined {
  const match = /^\$(\d+)$/u.exec(name.trim());
  if (match === null) {
    return undefined;
  }
  const index = Number(match[1]);
  return Number.isInteger(index) && index > 0 ? index : undefined;
}

export function countRequiredParameters(statement: Statement): number {
  let maxIndex = 0;
  const visitor = astVisitor((map) => ({
    parameter: (node) => {
      const index = parseParameterIndex(node.name);
      if (index !== undefined) {
        maxIndex = Math.max(maxIndex, index);
      }
      return map.super().parameter(node);
    },
  }));
  visitor.statement(statement);
  return maxIndex;
}

export function assertReadOnlySelectSql(
  sql: string,
  paramCount: number,
): Statement {
  const normalized = normalizeSingleStatementSql(sql);
  assertNoSelectInto(normalized);
  let statements: Statement[];
  try {
    statements = parse(normalized);
  } catch {
    invalidSql("SQL syntax is not valid.");
  }
  if (statements.length !== 1) {
    invalidSql("Exactly one SQL statement is required.");
  }
  const statement = statements[0]!;
  const rootType = (statement as { type: string }).type;
  if (!SELECT_ROOT_TYPES.has(rootType)) {
    invalidSql("Only read-only SELECT queries are allowed.");
  }
  assertSelectStatement(statement as SelectStatement);
  const requiredParams = countRequiredParameters(statement);
  if (requiredParams > paramCount) {
    invalidSql("SQL parameter placeholders exceed provided parameters.");
  }
  return statement;
}
