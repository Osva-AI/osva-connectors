# @osva-ai/connector-github

Read-only GitHub connector for OSVA Connector Profile V1.

## Configuration

| Variable                      | Required | Description                                                                                         |
| ----------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `OSVA_CONNECTOR_GITHUB_TOKEN` | Yes      | GitHub fine-grained personal access token with read access to the repositories you intend to query. |

The connector validates this variable at startup when launched via stdio.

## MCP tools

### `github.repository.get`

Returns a restricted JSON object with basic repository metadata.

**Input**

| Field   | Type   | Required |
| ------- | ------ | -------- |
| `owner` | string | yes      |
| `repo`  | string | yes      |

**Output fields**

`name`, `fullName`, `description`, `htmlUrl`, `visibility`, `defaultBranch`, `archived`, `fork`

## Authorization model

- **OSVA ToolPolicy** controls whether an agent may invoke a bound tool version.
- **GitHub credentials** control which repositories GitHub returns for a call.

This connector does not enforce OSVA-side tool permissions; it only performs read-only GitHub API requests using configured credentials.

## Run (stdio)

```bash
export OSVA_CONNECTOR_GITHUB_TOKEN="github_pat_..."
node ./dist/stdio.js
```

Or after building:

```bash
pnpm --filter @osva-ai/connector-github build
OSVA_CONNECTOR_GITHUB_TOKEN="..." pnpm --filter @osva-ai/connector-github exec node dist/stdio.js
```
