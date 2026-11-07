# `@osva-ai/connector-linear`

OSVA Connector Profile V1 **Linear** MCP connector (stdio): bounded **viewer/team/project/issue** reads, **issue search**, and controlled **issue/comment mutations** when explicitly enabled by the host.

## Tools

| Tool                    | Mode             |
| ----------------------- | ---------------- |
| `linear.viewer.get`     | Read             |
| `linear.team.list`      | Read             |
| `linear.issue.list`     | Read             |
| `linear.issue.get`      | Read             |
| `linear.issue.search`   | Read             |
| `linear.project.list`   | Read             |
| `linear.project.get`    | Read             |
| `linear.issue.create`   | Mutating (gated) |
| `linear.issue.update`   | Mutating (gated) |
| `linear.comment.create` | Mutating (gated) |

There is no arbitrary GraphQL execution tool—only fixed, reviewed operations over the Linear HTTP API.

## Environment

| Variable                                        | Description                                                     |
| ----------------------------------------------- | --------------------------------------------------------------- |
| `OSVA_CONNECTOR_LINEAR_API_KEY`                 | Personal API key (sent as the raw `Authorization` header value) |
| `OSVA_CONNECTOR_LINEAR_ACCESS_TOKEN`            | OAuth access token (sent as `Bearer …`)                         |
| `OSVA_CONNECTOR_LINEAR_WRITE_ENABLED`           | `true` to allow mutations                                       |
| `OSVA_CONNECTOR_LINEAR_HOST_MUTATIONS_APPROVED` | `true` after host workflow approval                             |
| `OSVA_CONNECTOR_LINEAR_ALLOWED_TEAM_IDS`        | Optional comma-separated team UUID allowlist for mutations      |
| `OSVA_CONNECTOR_LINEAR_TIMEOUT_MS`              | Request deadline (default 30000)                                |

At least one of `OSVA_CONNECTOR_LINEAR_API_KEY` or `OSVA_CONNECTOR_LINEAR_ACCESS_TOKEN` is required. When both are set, the API key is preferred.

Mutating tools cannot be enabled via tool arguments.

## Security

- Credentials are redacted from mapped errors; never returned in tool output.
- Issue titles, descriptions, and comments are **untrusted**.
- Mutations perform no connector-level retries.
