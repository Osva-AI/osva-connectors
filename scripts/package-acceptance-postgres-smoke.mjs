/**
 * MCP acceptance for an isolated npm install of @osva-ai/connector-postgres.
 * Requires a disposable PostgreSQL 16 fixture (see packages/postgres/docker).
 *
 * Run with cwd = acceptance install directory (node_modules present).
 *
 * Env:
 *   OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL — reader role URL (CI/local)
 */
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const INSTALL_DIR = process.cwd();
const REPO_ROOT_MARKER = path.join(
  "osva-connectors",
  "packages",
  "postgres",
  "src",
);

const EXPECTED_TOOLS = [
  "postgres.connection.test",
  "postgres.schema.list",
  "postgres.table.list",
  "postgres.column.list",
  "postgres.query.read",
];

const READER_PASSWORD = "reader_pass";

function integrationUrl() {
  const url =
    process.env.OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL ??
    process.env.OSVA_CONNECTOR_POSTGRES_ACCEPTANCE_URL;
  if (url === undefined || url.trim().length === 0) {
    throw new Error(
      "Set OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL (or OSVA_CONNECTOR_POSTGRES_ACCEPTANCE_URL).",
    );
  }
  return url.trim();
}

function npmBinShim() {
  const binDir = path.join(INSTALL_DIR, "node_modules", ".bin");
  if (process.platform === "win32") {
    return {
      command: path.join(binDir, "osva-connector-postgres.cmd"),
      args: [],
      shell: true,
    };
  }
  return {
    command: path.join(binDir, "osva-connector-postgres"),
    args: [],
    shell: false,
  };
}

function postgresChildEnv(overrides = {}) {
  const env = { ...process.env };
  delete env.OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL;
  delete env.OSVA_CONNECTOR_POSTGRES_ACCEPTANCE_URL;
  env.OSVA_CONNECTOR_POSTGRES_URL = integrationUrl();
  env.OSVA_CONNECTOR_POSTGRES_SSL_MODE = "disable";
  env.OSVA_CONNECTOR_POSTGRES_ALLOWED_SCHEMAS = "app";
  return { ...env, ...overrides };
}

function spawnWithDeadline(command, args, options, deadlineMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
    }, deadlineMs);
    child.on("error", reject);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

function assertNoSecrets(text, label) {
  if (text.includes(READER_PASSWORD)) {
    throw new Error(`Credential leaked in ${label}.`);
  }
  if (/postgresql:\/\/[^\s"']+:[^\s"']+@/i.test(text)) {
    throw new Error(`Connection URL with password leaked in ${label}.`);
  }
}

function assertNoStackTrace(text, label) {
  if (/at .+\(.+\:\d+:\d+\)/.test(text)) {
    throw new Error(`Stack trace leaked in ${label}.`);
  }
}

async function assertNotLinkedToSourceCheckout(packageDir) {
  const resolved = await fs.realpath(packageDir);
  if (
    resolved.replace(/\\/g, "/").includes(REPO_ROOT_MARKER.replace(/\\/g, "/"))
  ) {
    throw new Error(
      `Installed package resolves to source checkout: ${resolved}`,
    );
  }
}

async function assertSdkFromRegistry(installDir) {
  const sdkPkg = path.join(
    installDir,
    "node_modules",
    "@osva-ai/connector-sdk",
    "package.json",
  );
  const raw = await fs.readFile(sdkPkg, "utf8");
  const manifest = JSON.parse(raw);
  if (manifest.version !== "1.1.0-rc.2") {
    throw new Error(
      `Unexpected @osva-ai/connector-sdk version: ${manifest.version}`,
    );
  }
  const resolved = await fs.realpath(path.dirname(sdkPkg));
  if (
    resolved.replace(/\\/g, "/").includes(REPO_ROOT_MARKER.replace(/\\/g, "/"))
  ) {
    throw new Error(`connector-sdk resolves to monorepo source: ${resolved}`);
  }
}

async function testExportResolution() {
  const main = await import("@osva-ai/connector-postgres");
  if (typeof main.createPostgresConnector !== "function") {
    throw new Error("Missing createPostgresConnector export.");
  }
  const stdioEntry = path.join(
    INSTALL_DIR,
    "node_modules",
    "@osva-ai/connector-postgres",
    "dist",
    "stdio.js",
  );
  await fs.access(stdioEntry);
  const pkg = JSON.parse(
    await fs.readFile(
      path.join(
        INSTALL_DIR,
        "node_modules",
        "@osva-ai/connector-postgres",
        "package.json",
      ),
      "utf8",
    ),
  );
  if (pkg.exports?.["./stdio"]?.import !== "./dist/stdio.js") {
    throw new Error("Unexpected ./stdio export map in installed package.");
  }
}

async function testMissingUrlStartup() {
  const shim = npmBinShim();
  const env = { ...process.env };
  delete env.OSVA_CONNECTOR_POSTGRES_URL;
  delete env.OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL;
  delete env.OSVA_CONNECTOR_POSTGRES_ACCEPTANCE_URL;
  const result = await spawnWithDeadline(
    shim.command,
    shim.args,
    { env, shell: shim.shell },
    10_000,
  );
  if (result.code === 0) {
    throw new Error("Expected non-zero exit when URL is missing.");
  }
  assertNoSecrets(`${result.stdout}\n${result.stderr}`, "missing-url startup");
}

async function testInvalidUrlStartup() {
  const shim = npmBinShim();
  const result = await spawnWithDeadline(
    shim.command,
    shim.args,
    {
      env: {
        ...process.env,
        OSVA_CONNECTOR_POSTGRES_URL: "not-a-valid-postgres-url",
        OSVA_CONNECTOR_POSTGRES_SSL_MODE: "disable",
      },
      shell: shim.shell,
    },
    10_000,
  );
  if (result.code === 0) {
    throw new Error("Expected non-zero exit for invalid URL.");
  }
  assertNoSecrets(`${result.stdout}\n${result.stderr}`, "invalid-url startup");
}

async function connectMcpClient(envOverrides = {}) {
  const shim = npmBinShim();
  let serverStderr = "";
  const transport = new StdioClientTransport({
    command: shim.command,
    args: shim.args,
    env: postgresChildEnv(envOverrides),
    stderr: "pipe",
  });
  transport.stderr?.on("data", (chunk) => {
    serverStderr += String(chunk);
  });
  const client = new Client({
    name: "package-acceptance-postgres",
    version: "1.0.0",
  });
  try {
    await client.connect(transport);
  } catch (error) {
    throw new Error(
      `MCP connect failed: ${error instanceof Error ? error.message : error}\nserver stderr: ${serverStderr}`,
    );
  }
  return { client, getServerStderr: () => serverStderr };
}

async function testFiveToolsAndPrivileges() {
  const { client, getServerStderr } = await connectMcpClient();
  try {
    const listed = await client.listTools({});
    const names = listed.tools.map((t) => t.name);
    for (const expected of EXPECTED_TOOLS) {
      if (!names.includes(expected)) {
        throw new Error(`Missing tool ${expected} in tools/list.`);
      }
    }
    if (new Set(names).size !== names.length) {
      throw new Error("Duplicate tool names in tools/list.");
    }

    const health = await client.callTool({
      name: "postgres.connection.test",
      arguments: {},
    });
    if (health.isError === true) {
      throw new Error(`connection.test failed: ${JSON.stringify(health)}`);
    }
    const version = health.structuredContent?.serverVersion;
    if (typeof version !== "string" || version.length === 0) {
      throw new Error("connection.test missing serverVersion.");
    }
    assertNoSecrets(JSON.stringify(health), "connection.test result");

    const schemas = await client.callTool({
      name: "postgres.schema.list",
      arguments: {},
    });
    if (schemas.isError === true) {
      throw new Error(`schema.list failed: ${JSON.stringify(schemas)}`);
    }
    const schemaNames = (schemas.structuredContent?.schemas ?? []).map(
      (row) => row.name,
    );
    if (!schemaNames.includes("app")) {
      throw new Error(`Expected app schema; got ${schemaNames.join(", ")}`);
    }
    for (const forbidden of ["secret", "pg_catalog", "information_schema"]) {
      if (schemaNames.includes(forbidden)) {
        throw new Error(`Forbidden schema visible: ${forbidden}`);
      }
    }

    const tables = await client.callTool({
      name: "postgres.table.list",
      arguments: { schema: "app" },
    });
    if (tables.isError === true) {
      throw new Error(`table.list failed: ${JSON.stringify(tables)}`);
    }
    const tableNames = new Set(
      (tables.structuredContent?.tables ?? []).map((row) => row.name),
    );
    for (const expected of ["users", "events_view", "partial_cols"]) {
      if (!tableNames.has(expected)) {
        throw new Error(`Missing table ${expected}`);
      }
    }
    if (tableNames.has("no_access")) {
      throw new Error("no_access table must not appear in table.list");
    }

    const allowlistDenied = await client.callTool({
      name: "postgres.table.list",
      arguments: { schema: "analytics" },
    });
    if (allowlistDenied.isError !== true) {
      throw new Error(
        "Expected FORBIDDEN for analytics schema outside allowlist.",
      );
    }
    assertNoSecrets(JSON.stringify(allowlistDenied), "allowlist denial");

    const columns = await client.callTool({
      name: "postgres.column.list",
      arguments: { schema: "app", table: "partial_cols" },
    });
    if (columns.isError === true) {
      throw new Error(`column.list failed: ${JSON.stringify(columns)}`);
    }
    const colNames = (columns.structuredContent?.columns ?? []).map(
      (col) => col.name,
    );
    if (colNames.join(",") !== "col_a") {
      throw new Error(`Unexpected partial_cols columns: ${colNames.join(",")}`);
    }

    const query = await client.callTool({
      name: "postgres.query.read",
      arguments: {
        sql: "SELECT id, email FROM app.users WHERE id = $1",
        params: [1],
        maxRows: 10,
      },
    });
    if (query.isError === true) {
      throw new Error(`query.read failed: ${JSON.stringify(query)}`);
    }
    const structured = query.structuredContent;
    if (structured?.rowCount < 1) {
      throw new Error("query.read returned no rows.");
    }
    if (!Array.isArray(structured?.rows?.[0])) {
      throw new Error("query.read rows must be positional arrays.");
    }

    const limited = await client.callTool({
      name: "postgres.query.read",
      arguments: {
        sql: "SELECT id FROM generate_series(1, 20) AS id",
        maxRows: 5,
      },
    });
    if (limited.isError === true) {
      throw new Error(`truncation query failed: ${JSON.stringify(limited)}`);
    }
    if (limited.structuredContent?.rowCount !== 5) {
      throw new Error("maxRows truncation not applied.");
    }
    if (limited.structuredContent?.truncated !== true) {
      throw new Error("truncated flag expected for maxRows cap.");
    }

    const mutation = await client.callTool({
      name: "postgres.query.read",
      arguments: { sql: "INSERT INTO app.users VALUES (99, 'x')" },
    });
    if (mutation.isError !== true) {
      throw new Error("Expected SQL admission rejection for INSERT.");
    }

    const forbiddenQuery = await client.callTool({
      name: "postgres.query.read",
      arguments: { sql: "SELECT col_b FROM app.partial_cols" },
    });
    if (forbiddenQuery.isError !== true) {
      throw new Error("Expected FORBIDDEN for unauthorized column SELECT.");
    }
    assertNoStackTrace(
      JSON.stringify(forbiddenQuery),
      "forbidden column error",
    );

    const hiddenSchema = await client.callTool({
      name: "postgres.query.read",
      arguments: { sql: "SELECT token FROM secret.credentials" },
    });
    if (hiddenSchema.isError !== true) {
      throw new Error("Expected error for secret.credentials query.");
    }
    assertNoSecrets(JSON.stringify(hiddenSchema), "hidden schema error");

    const malformed = await client.callTool({
      name: "postgres.table.list",
      arguments: {},
    });
    if (malformed.isError !== true) {
      throw new Error("Expected INVALID_INPUT for table.list without schema.");
    }

    assertNoSecrets(getServerStderr(), "server stderr during happy path");
  } finally {
    await client.close();
  }
}

async function testAuthFailure() {
  const badUrl = integrationUrl().replace(
    `:${READER_PASSWORD}@`,
    ":wrong_password@",
  );
  const { client } = await connectMcpClient({
    OSVA_CONNECTOR_POSTGRES_URL: badUrl,
  });
  try {
    const result = await client.callTool({
      name: "postgres.connection.test",
      arguments: {},
    });
    if (result.isError !== true) {
      throw new Error("Expected auth failure for connection.test.");
    }
    assertNoSecrets(JSON.stringify(result), "auth failure payload");
    assertNoStackTrace(JSON.stringify(result), "auth failure payload");
  } finally {
    await client.close();
  }
}

async function testUnavailableDatabase() {
  const unreachable = integrationUrl().replace(":55432/", ":59999/");
  const { client } = await connectMcpClient({
    OSVA_CONNECTOR_POSTGRES_URL: unreachable,
  });
  try {
    const result = await client.callTool({
      name: "postgres.connection.test",
      arguments: {},
    });
    if (result.isError !== true) {
      throw new Error("Expected failure when database is unreachable.");
    }
    assertNoSecrets(JSON.stringify(result), "unreachable db error");
  } finally {
    await client.close();
  }
}

async function testTimeoutsAndRecovery() {
  const { client } = await connectMcpClient({
    OSVA_CONNECTOR_POSTGRES_QUERY_TIMEOUT_MS: "1000",
    OSVA_CONNECTOR_POSTGRES_TOTAL_TIMEOUT_MS: "30000",
  });
  try {
    const slow = await client.callTool({
      name: "postgres.query.read",
      arguments: { sql: "SELECT app.sleep_seconds(2)" },
    });
    if (slow.isError !== true) {
      throw new Error("Expected TIMEOUT for statement_timeout breach.");
    }
    if (slow.structuredContent?.code !== "TIMEOUT") {
      throw new Error(
        `Expected TIMEOUT code; got ${JSON.stringify(slow.structuredContent)}`,
      );
    }

    const ping = await client.callTool({
      name: "postgres.connection.test",
      arguments: {},
    });
    if (ping.isError === true) {
      throw new Error("Pool did not recover after statement timeout.");
    }
  } finally {
    await client.close();
  }

  const { client: deadlineClient } = await connectMcpClient({
    OSVA_CONNECTOR_POSTGRES_TOTAL_TIMEOUT_MS: "5000",
    OSVA_CONNECTOR_POSTGRES_QUERY_TIMEOUT_MS: "120000",
  });
  try {
    const total = await deadlineClient.callTool({
      name: "postgres.query.read",
      arguments: { sql: "SELECT app.sleep_seconds(8)" },
    });
    if (total.isError !== true) {
      throw new Error("Expected total deadline TIMEOUT.");
    }
    if (total.structuredContent?.code !== "TIMEOUT") {
      throw new Error(
        `Expected TIMEOUT for total deadline; got ${JSON.stringify(total.structuredContent)}`,
      );
    }
    const deadlineMessage = String(total.structuredContent?.message ?? "");
    if (!deadlineMessage.includes("total operation deadline")) {
      throw new Error(`Unexpected total deadline message: ${deadlineMessage}`);
    }

    const ping = await deadlineClient.callTool({
      name: "postgres.connection.test",
      arguments: {},
    });
    if (ping.isError === true) {
      throw new Error("Pool did not recover after total deadline.");
    }
  } finally {
    await deadlineClient.close();
  }
}

async function main() {
  integrationUrl();
  const connectorDir = path.join(
    INSTALL_DIR,
    "node_modules",
    "@osva-ai/connector-postgres",
  );
  await assertNotLinkedToSourceCheckout(connectorDir);
  await assertSdkFromRegistry(INSTALL_DIR);
  await testExportResolution();

  const binPath = path.join(
    INSTALL_DIR,
    "node_modules",
    ".bin",
    process.platform === "win32"
      ? "osva-connector-postgres.cmd"
      : "osva-connector-postgres",
  );
  await fs.access(binPath);

  await testMissingUrlStartup();
  await testInvalidUrlStartup();
  await testFiveToolsAndPrivileges();
  await testAuthFailure();
  await testUnavailableDatabase();
  await testTimeoutsAndRecovery();
  console.log("package-acceptance-postgres-smoke: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
