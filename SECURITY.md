# Security Policy

## Supported versions

Security fixes are applied to the latest release on the default branch.

## Reporting a vulnerability

Please report security issues privately to the OSVA maintainers through your organization's coordinated disclosure process. Do not open public issues for undisclosed vulnerabilities.

Include:

- Affected package and version
- Steps to reproduce
- Impact assessment
- Suggested remediation, if available

## Connector security expectations

- Never log tokens, authorization headers, or raw provider error bodies.
- Treat upstream API responses and exception messages as untrusted.
- Keep connectors read-only unless explicitly documented otherwise.
- Use OSVA ToolPolicy for agent-side authorization; GitHub credentials control provider-side access.
