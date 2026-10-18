# @osva-ai/connector-github

Read-only GitHub connector for [OSVA Connector Profile V1](https://github.com/Osva-AI/osva/blob/main/docs/contracts/CONNECTOR_PROFILE_V1.md).

## Configuration

| Variable                      | Required | Description                                |
| ----------------------------- | -------- | ------------------------------------------ |
| `OSVA_CONNECTOR_GITHUB_TOKEN` | Yes      | GitHub fine-grained personal access token. |

Validated at stdio startup.

### Recommended token permissions (read-only)

| Repository access    | Fine-grained permissions                              |
| -------------------- | ----------------------------------------------------- |
| Public repositories  | **Metadata** (read) and **Issues** (read)             |
| Private repositories | Same permissions on repositories the token can access |

Public repo metadata may be reachable without an Issues scope in some cases, but **issue list/get requires Issues (read)** for reliable behavior.

OSVA **ToolPolicy** controls whether an agent may invoke a tool. The GitHub token controls which repositories and issues GitHub returns.

## MCP tools

### `github.repository.get`

Returns basic repository metadata.

**Input:** `owner`, `repo`

**Output:** `name`, `fullName`, `description`, `htmlUrl`, `visibility`, `defaultBranch`, `archived`, `fork`

### `github.issue.list`

Lists issues for a repository using **one GitHub REST request per tool invocation**.

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

**Pagination semantics**

- Page-based pagination matches GitHub's `page` / `per_page` parameters.
- GitHub's issues list endpoint can include pull requests; this tool **filters pull requests out** after the response is received.
- A page may therefore contain **fewer than `perPage` issues** even when GitHub returned a full API page.
- **`hasNextPage` is not inferred from issue count.** It reflects GitHub's `Link: ...; rel="next"` header only.
- No automatic page traversal: callers must increment `page` explicitly.

**Normalized issue shape**

`number`, `title`, `state`, `htmlUrl`, `createdAt`, `updatedAt`, `closedAt`, `authorLogin`, `labels`, `commentsCount`, optional `labelsTruncated`

Issue bodies are **not** returned in C1.1.

**Output-size policy**

- At most **100** issues per response (`perPage` max).
- At most **30** label names per issue; label names truncated to **100** characters.
- When labels are truncated, `labelsTruncated: true` is set on that issue.

### `github.issue.get`

**Input:** `owner`, `repo`, `issueNumber` (positive integer)

**Output:** Same normalized issue shape as `github.issue.list`.

If the number refers to a **pull request**, the tool returns `NOT_ISSUE`.

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

## Error behavior

Tool failures map to structured MCP errors via `@osva-ai/connector-sdk` (`ConnectorSdkError` codes such as `INVALID_INPUT`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `NOT_ISSUE`, `RATE_LIMITED`, `TIMEOUT`, `CANCELLED`, `PROVIDER_ERROR`).

GitHub **403** responses with rate-limit headers (`X-RateLimit-Remaining: 0` or `Retry-After`) map to **`RATE_LIMITED`**. Other 403 responses map to **`FORBIDDEN`**.

Errors do not include tokens, authorization headers, raw GitHub bodies, or arbitrary provider exception text.

## Run (stdio)

```bash
export OSVA_CONNECTOR_GITHUB_TOKEN="github_pat_..."
node ./dist/stdio.js
```

## Read-only guarantee

This connector performs read-only GitHub REST operations only (repository metadata and issue reads).
