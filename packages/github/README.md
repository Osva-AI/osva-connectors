# @osva-ai/connector-github

GitHub connector for [OSVA Connector Profile V1](https://github.com/Osva-AI/osva/blob/main/docs/contracts/CONNECTOR_PROFILE_V1.md): repository lookup, issue read, **issue create**, and **issue comment create** (mutating).

## Configuration

| Variable                      | Required | Description                                |
| ----------------------------- | -------- | ------------------------------------------ |
| `OSVA_CONNECTOR_GITHUB_TOKEN` | Yes      | GitHub fine-grained personal access token. |

Validated at stdio startup.

### Recommended fine-grained token permissions

Use a **dedicated token** scoped only to repositories that agents should access.

| Capability                                           | Repository access                         | Permissions                                         |
| ---------------------------------------------------- | ----------------------------------------- | --------------------------------------------------- |
| `github.repository.get`                              | Public or private repos the token can see | **Metadata** (read)                                 |
| `github.issue.list`, `github.issue.get`              | Same                                      | **Metadata** (read) and **Issues** (read)           |
| `github.issue.create`, `github.issue.comment.create` | Same                                      | **Metadata** (read) and **Issues** (read and write) |

**Public vs private:** A token with access only to selected public repositories cannot read or create issues in private repositories unless those repositories are included in the token's resource owner / repository list. Metadata (read) alone is not sufficient for issue operations.

OSVA **ToolPolicy** and explicit tool bindings control whether an agent may invoke a tool at the platform boundary. The GitHub token controls which repositories GitHub allows. MCP tool discovery does **not** imply approval. The Community ToolPolicy may be permissive; least-privilege deployments should bind only required tools and use read-only tokens when writes are not needed.

This connector does **not** implement human approval, risk scoring, or workspace authorization. `@osva-ai/connector-sdk` tool definitions expose `name`, `description`, `inputSchema`, and a handler only—there is no supported approval or risk metadata field on tools in SDK `1.1.0-rc.2`. Agents granted a mutating tool may invoke it unless the calling OSVA application enforces additional restrictions.

**Recommended deployment:** dedicated fine-grained PAT scoped to specific repositories; ToolPolicy/tool bindings listing only required tools; separate credentials for read-only vs write workflows; explicit human approval in OSVA Console or workflow **before** mutating tool calls when your policy requires it.

## Untrusted provider content

Issue titles, bodies, labels, and comments from GitHub are **untrusted data**. The connector passes them through normalization and JSON serialization only—it does not execute embedded instructions, change credentials, or invoke other tools. Input bounds (for example title max **256** characters, body max **32,000** on writes) are enforced **before** provider calls. Outputs apply [runtime output budgets](#output-bounds-c31) with explicit truncation flags where text is shortened; they are **not** a substitute for agent-level prompt-injection defenses in the OSVA runtime.

## Production Octokit factory vs injected clients

Stdio startup uses `createOctokitGithubClient({ token })`, which builds Octokit via **`createGithubOctokit()`**—mutation-safe throttling handlers plus per-request `retries: 0` and an internal no-auto-retry marker on issue create and comment create.

For tests or embedding you may pass `octokit` to `createOctokitGithubClient`. **Arbitrary `new Octokit(...)` instances are outside that guarantee:** default Octokit plugins may auto-retry throttled mutating POSTs even when individual requests set `retries: 0`. Use `createGithubOctokit()` for production-equivalent behavior.

## MCP tools

### `github.repository.get`

Returns basic repository metadata (read-only).

**Input:** `owner`, `repo`

**Output:** `name`, `fullName`, `description`, `htmlUrl`, `visibility`, `defaultBranch`, `archived`, `fork`

### `github.issue.list`

Lists issues for a repository using **one GitHub REST request per tool invocation** (read-only).

**Input**

| Field     | Type                        | Default  | Limits                 |
| --------- | --------------------------- | -------- | ---------------------- |
| `owner`   | string                      | required | GitHub-compatible slug |
| `repo`    | string                      | required | GitHub-compatible slug |
| `state`   | `open` \| `closed` \| `all` | `open`   | enum                   |
| `perPage` | integer                     | `20`     | 1–100                  |
| `page`    | integer                     | `1`      | 1–100                  |

**Output**

| Field         | Description                                                               |
| ------------- | ------------------------------------------------------------------------- |
| `issues`      | Normalized issues (pull requests excluded)                                |
| `page`        | Requested GitHub API page                                                 |
| `perPage`     | Requested page size                                                       |
| `hasNextPage` | Present and `true` only when GitHub's `Link` header includes `rel="next"` |

See prior slices for pagination semantics and normalized issue fields.

### `github.issue.get`

**Input:** `owner`, `repo`, `issueNumber` (positive integer)

**Output:** Same normalized issue shape as `github.issue.list` (read-only).

If the number refers to a **pull request**, the tool returns `NOT_ISSUE`.

### `github.issue.create` (mutating)

Creates a GitHub issue via **`POST /repos/{owner}/{repo}/issues`** (Octokit `issues.create`). **Exactly one** GitHub create request per invocation. The connector performs **no application-level retries** and disables automatic Octokit retries for this call. GitHub does not expose a guaranteed idempotency key for issue creation in this implementation—duplicate invocations can create duplicate issues.

**Input**

| Field   | Type   | Required | Limits                                       |
| ------- | ------ | -------- | -------------------------------------------- |
| `owner` | string | yes      | GitHub-compatible slug (same as other tools) |
| `repo`  | string | yes      | GitHub-compatible slug                       |
| `title` | string | yes      | Trimmed, non-empty, max **256** characters   |
| `body`  | string | no       | Markdown, max **32,000** characters          |

Assignees, labels, milestones, and other fields are **not** supported in this slice.

**Output (normalized only)**

`number`, `title`, `state`, `htmlUrl`, `createdAt`, `authorLogin`

Invalid or oversized input is rejected **before** any GitHub request.

**Ambiguous failures:** Timeouts, network errors, or HTTP 5xx responses after submission do **not** prove the issue was or was not created. Verify on GitHub before retrying.

### `github.issue.comment.create` (mutating)

Creates a comment on a GitHub **issue** via **`POST /repos/{owner}/{repo}/issues/{issue_number}/comments`** (Octokit `issues.createComment`). Pull requests are rejected using a preliminary **`GET /repos/{owner}/{repo}/issues/{issue_number}`**; the comment POST is **not** sent when the target is a pull request.

**Race / limitation:** GitHub does not offer an atomic “comment only if issue” operation. Issue state could theoretically change between the GET and POST (for example, metadata updates). This connector never POSTs when the GET identifies a pull request, but it cannot guarantee issue state is unchanged at POST time.

**Input**

| Field         | Type    | Required | Limits                                                 |
| ------------- | ------- | -------- | ------------------------------------------------------ |
| `owner`       | string  | yes      | GitHub-compatible slug (same as other tools)           |
| `repo`        | string  | yes      | GitHub-compatible slug                                 |
| `issueNumber` | integer | yes      | Positive integer (issue, not pull request)             |
| `body`        | string  | yes      | Trimmed, non-empty Markdown, max **32,000** characters |

**Output (normalized only)**

`id`, `issueNumber`, `body`, `htmlUrl`, `createdAt`, `authorLogin`

Each invocation performs **one issue GET** (read-only retries allowed) and **exactly one comment POST** with **no connector-level retries** on the POST. Duplicate invocations can create duplicate comments; GitHub does not expose a guaranteed idempotency key here.

**Ambiguous failures:** Timeouts, network errors, or HTTP 5xx / rate-limit responses on the **comment POST** do **not** prove the comment was or was not created. Verify on GitHub before retrying.

## Example MCP tool calls

```json
{
  "name": "github.issue.list",
  "arguments": {
    "owner": "Osva-AI",
    "repo": "osva",
    "state": "open",
    "page": 1,
    "perPage": 20
  }
}
```

```json
{
  "name": "github.issue.get",
  "arguments": {
    "owner": "Osva-AI",
    "repo": "osva",
    "issueNumber": 42
  }
}
```

```json
{
  "name": "github.issue.create",
  "arguments": {
    "owner": "Osva-AI",
    "repo": "osva",
    "title": "Investigate connector timeout",
    "body": "## Context\n\nObserved in staging."
  }
}
```

```json
{
  "name": "github.issue.comment.create",
  "arguments": {
    "owner": "Osva-AI",
    "repo": "osva",
    "issueNumber": 42,
    "body": "Reproduced on latest main."
  }
}
```

## Error behavior

Tool failures map to structured MCP errors via `@osva-ai/connector-sdk` (`ConnectorSdkError` codes such as `INVALID_INPUT`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `NOT_ISSUE`, `RATE_LIMITED`, `TIMEOUT`, `CANCELLED`, `PROVIDER_ERROR`).

GitHub **403** responses with rate-limit headers (`X-RateLimit-Remaining: 0` or `Retry-After`) map to **`RATE_LIMITED`**. Other 403 responses map to **`FORBIDDEN`**. GitHub **422** validation failures map to **`INVALID_INPUT`**.

Errors do not include tokens, authorization headers, raw GitHub bodies, stack traces, or arbitrary provider exception text. Ambiguous write failures use a generic verify-on-GitHub message with `retryable: false`.

## Output bounds (C3.1)

Every tool response is bounded at runtime at the **normalized handler payload** layer.

**Guaranteed (connector):** `JSON.stringify(structuredContent)` — the structured tool result object returned by each handler — is at most **262,144 UTF-8 bytes** (`256 KiB`) per successful invocation. Field-level caps use **Unicode code point** counts; the total-size check uses **UTF-8 byte length** of the serialized structured object.

**Not guaranteed (SDK / MCP wire):** `@osva-ai/connector-sdk` also embeds the same JSON in `CallToolResult.content[].text`, so the full MCP `tools/call` message can be **larger than 256 KiB** (typically roughly twice the structured payload plus protocol framing). Clients measuring transport size should use the MCP result envelope, not assume it equals the connector structured budget.

Provider-controlled strings are truncated by code point where noted below (emoji and valid surrogate pairs are not split). Truncation is never silent: optional boolean fields mark shortened content.

### Per-field maximums (normalized output)

| Field / area                                   | Max (code points unless noted) | Truncation flag                     |
| ---------------------------------------------- | ------------------------------ | ----------------------------------- |
| Repository `description`                       | 4,096                          | `descriptionTruncated`              |
| Repository `name`, `fullName`, `defaultBranch` | 256 / 512 / 255                | Error if exceeded (identity fields) |
| Issue / create `title`                         | 512                            | `titleTruncated`                    |
| `authorLogin`                                  | 100                            | `authorLoginTruncated`              |
| Comment create `body`                          | 32,000                         | `bodyTruncated`                     |
| `htmlUrl` and other URLs                       | 2,048 chars                    | Error if exceeded (not truncated)   |
| ISO timestamps                                 | 64 chars                       | Error if exceeded                   |
| Labels per issue                               | 30 labels × 100 chars          | `labelsTruncated`                   |

### `github.issue.list` collections

- `page`, `perPage`, and `hasNextPage` reflect the **GitHub REST request** (pagination metadata is not rewritten).
- When the normalized page would exceed the **256 KiB** output budget, the connector returns a **prefix** of issues from that GitHub page and sets **`issuesTruncated: true`**. This is distinct from `hasNextPage`: you may need a smaller `perPage`, another `page`, or `github.issue.get` for omitted issues on the same GitHub page.
- If a single issue cannot fit within the budget even after field-level truncation, the tool returns **`PROVIDER_ERROR`** (sanitized size-limit message).

### Malformed provider data

Invalid types, URLs, or timestamps from GitHub map to **`PROVIDER_ERROR`** with generic messages (no raw provider bodies). Output-normalization failures do **not** trigger mutation retries.

### Prompt injection

GitHub text remains **untrusted data** in outputs. Truncation does not remove “malicious instructions”; agents must apply OSVA/runtime policy separately.

### Mutations

Issue and comment **create** paths keep **one POST**, no connector retries, and ambiguous failure semantics from C2.x. Successful mutations return bounded create payloads; oversized comment bodies from GitHub are truncated with `bodyTruncated` rather than failing the tool.

## Run (stdio)

```bash
export OSVA_CONNECTOR_GITHUB_TOKEN="github_pat_..."
node ./dist/stdio.js
```

## Mutating vs read-only tools

| Tool                          | Mutates GitHub state |
| ----------------------------- | -------------------- |
| `github.repository.get`       | No                   |
| `github.issue.list`           | No                   |
| `github.issue.get`            | No                   |
| `github.issue.create`         | **Yes**              |
| `github.issue.comment.create` | **Yes**              |
