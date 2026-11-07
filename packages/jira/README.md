# `@osva-ai/connector-jira`

OSVA Connector Profile V1 **Jira Cloud** MCP connector (stdio): bounded **project** and **issue** reads (JQL via `POST /rest/api/3/search/jql` with `nextPageToken`), transition discovery, and controlled **issue mutations** when explicitly enabled by the host.

## Tools

| Tool                          | Mode             |
| ----------------------------- | ---------------- |
| `jira.project.list`           | Read             |
| `jira.project.get`            | Read             |
| `jira.issue.search`           | Read             |
| `jira.issue.get`              | Read             |
| `jira.issue.transitions.list` | Read             |
| `jira.issue.create`           | Mutating (gated) |
| `jira.issue.update`           | Mutating (gated) |
| `jira.issue.comment.create`   | Mutating (gated) |
| `jira.issue.transition`       | Mutating (gated) |

## Authentication

Configure **one** of:

1. **Site + API token (Basic):** `OSVA_CONNECTOR_JIRA_SITE_URL` + `OSVA_CONNECTOR_JIRA_EMAIL` + `OSVA_CONNECTOR_JIRA_API_TOKEN`
2. **Site + OAuth/access token (Bearer):** `OSVA_CONNECTOR_JIRA_SITE_URL` + `OSVA_CONNECTOR_JIRA_ACCESS_TOKEN`
3. **Cloud ID + OAuth (Bearer on Atlassian API):** `OSVA_CONNECTOR_JIRA_CLOUD_ID` + `OSVA_CONNECTOR_JIRA_ACCESS_TOKEN`

## Environment

| Variable                                   | Description                                                         |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `OSVA_CONNECTOR_JIRA_SITE_URL`             | `https://your-site.atlassian.net` (modes 1–2)                       |
| `OSVA_CONNECTOR_JIRA_CLOUD_ID`             | Atlassian cloud ID (mode 3)                                         |
| `OSVA_CONNECTOR_JIRA_EMAIL`                | Account email (mode 1)                                              |
| `OSVA_CONNECTOR_JIRA_API_TOKEN`            | API token (mode 1)                                                  |
| `OSVA_CONNECTOR_JIRA_ACCESS_TOKEN`         | OAuth or PAT bearer token (modes 2–3)                               |
| `OSVA_CONNECTOR_JIRA_WRITE_ENABLED`        | `true` to allow mutations                                           |
| `OSVA_CONNECTOR_JIRA_HOST_WRITES_APPROVED` | `true` after host workflow approval                                 |
| `OSVA_CONNECTOR_JIRA_ALLOWED_PROJECT_KEYS` | Comma-separated keys; absent = unrestricted reads; empty = deny all |
| `OSVA_CONNECTOR_JIRA_TIMEOUT_MS`           | Request deadline (default 30000)                                    |

When `OSVA_CONNECTOR_JIRA_ALLOWED_PROJECT_KEYS` is set, JQL is wrapped with `AND project in (...)` and cross-project JQL is rejected. Mutations require a **non-empty** allowlist when the env var is present.

Mutating tools cannot be enabled via tool arguments.

## Security

- Credentials are redacted from mapped errors; never returned in tool output.
- Issue summaries, descriptions, and comments are **untrusted**.
- Issue search uses the Jira Cloud REST API v3 **search/jql** endpoint (not legacy `/search`).
- Mutations perform no connector-level retries.
