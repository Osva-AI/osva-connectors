# @osva-ai/connector-github

GitHub connector for [OSVA Connector Profile V1](https://github.com/Osva-AI/osva/blob/main/docs/contracts/CONNECTOR_PROFILE_V1.md): repository lookup, issue read, and **issue create** (mutating).

## Configuration

| Variable                      | Required | Description                                |
| ----------------------------- | -------- | ------------------------------------------ |
| `OSVA_CONNECTOR_GITHUB_TOKEN` | Yes      | GitHub fine-grained personal access token. |

Validated at stdio startup.

### Recommended fine-grained token permissions

Use a **dedicated token** scoped only to repositories that agents should access.

| Capability                              | Repository access                         | Permissions                                         |
| --------------------------------------- | ----------------------------------------- | --------------------------------------------------- |
| `github.repository.get`                 | Public or private repos the token can see | **Metadata** (read)                                 |
| `github.issue.list`, `github.issue.get` | Same                                      | **Metadata** (read) and **Issues** (read)           |
| `github.issue.create`                   | Same                                      | **Metadata** (read) and **Issues** (read and write) |

**Public vs private:** A token with access only to selected public repositories cannot read or create issues in private repositories unless those repositories are included in the token's resource owner / repository list. Metadata (read) alone is not sufficient for issue operations.

OSVA **ToolPolicy** controls whether an agent may invoke a tool at the platform boundary. The GitHub token controls which repositories GitHub allows. This connector does **not** implement human approval or workspace authorization; workflows that require explicit human approval must enforce that in OSVA before calling mutating tools.

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

## Error behavior

Tool failures map to structured MCP errors via `@osva-ai/connector-sdk` (`ConnectorSdkError` codes such as `INVALID_INPUT`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `NOT_ISSUE`, `RATE_LIMITED`, `TIMEOUT`, `CANCELLED`, `PROVIDER_ERROR`).

GitHub **403** responses with rate-limit headers (`X-RateLimit-Remaining: 0` or `Retry-After`) map to **`RATE_LIMITED`**. Other 403 responses map to **`FORBIDDEN`**. GitHub **422** validation failures map to **`INVALID_INPUT`**.

Errors do not include tokens, authorization headers, raw GitHub bodies, or arbitrary provider exception text.

## Run (stdio)

```bash
export OSVA_CONNECTOR_GITHUB_TOKEN="github_pat_..."
node ./dist/stdio.js
```

## Mutating vs read-only tools

| Tool                    | Mutates GitHub state |
| ----------------------- | -------------------- |
| `github.repository.get` | No                   |
| `github.issue.list`     | No                   |
| `github.issue.get`      | No                   |
| `github.issue.create`   | **Yes**              |
