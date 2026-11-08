# @osva-ai/connector-zoho-crm

OSVA MCP connector for [Zoho CRM API v8](https://www.zoho.com/crm/developer/docs/api/v8/). Exposes bounded reads on Leads, Accounts, Contacts, and Deals, plus gated deal stage updates and internal deal notes.

## Tools (11)

| Tool                                     | Description                                             |
| ---------------------------------------- | ------------------------------------------------------- |
| `zoho.lead.list` / `zoho.lead.get`       | List and fetch leads                                    |
| `zoho.account.list` / `zoho.account.get` | List and fetch accounts                                 |
| `zoho.contact.list` / `zoho.contact.get` | List and fetch contacts                                 |
| `zoho.deal.list` / `zoho.deal.get`       | List and fetch deals                                    |
| `zoho.deal.stage.list`                   | Deal stage picklist from `settings/fields?module=Deals` |
| `zoho.deal.stage.set`                    | Update deal stage (gated)                               |
| `zoho.deal.note.add`                     | Add internal deal note (gated; never portal-shared)     |

Record identifiers are **string-only** in tool inputs and normalized outputs (large Zoho ids are never passed as JavaScript numbers).

## Configuration

| Variable                                          | Required        | Description                                        |
| ------------------------------------------------- | --------------- | -------------------------------------------------- |
| `OSVA_CONNECTOR_ZOHO_CRM_ACCESS_TOKEN`            | Yes             | Zoho OAuth access token                            |
| `OSVA_CONNECTOR_ZOHO_CRM_REGION`                  | Yes             | `us`, `eu`, `in`, `au`, `jp`, `uk`, or `ca`        |
| `OSVA_CONNECTOR_ZOHO_CRM_ALLOWED_RESOURCE_IDS`    | For mutations   | Comma-separated deal ids                           |
| `OSVA_CONNECTOR_ZOHO_CRM_ALLOWED_TARGET_STATUSES` | Optional        | Allowed deal stages for `deal.stage.set`           |
| `OSVA_CONNECTOR_ZOHO_CRM_NOTES_ENABLED`           | Default `false` | Enable `deal.note.add`                             |
| `OSVA_CONNECTOR_ZOHO_CRM_STATUS_ENABLED`          | Default `false` | Enable `deal.stage.set`                            |
| `OSVA_CONNECTOR_ZOHO_CRM_HOST_WRITES_APPROVED`    | Default `false` | Host write approval for mutations                  |
| `OSVA_CONNECTOR_ZOHO_CRM_INCLUDE_PII`             | Default `false` | Include email fields in normalized output          |
| `OSVA_CONNECTOR_ZOHO_CRM_TIMEOUT_MS`              | Optional        | Request timeout (default 30000)                    |
| `OSVA_CONNECTOR_ZOHO_CRM_API_BASE_URL`            | Test only       | Override API base (requires `ALLOW_TEST_API_HOST`) |
| `OSVA_CONNECTOR_ZOHO_CRM_ALLOW_TEST_API_HOST`     | Test only       | Allow custom base URL                              |

API requests use the `Zoho-oauthtoken` authorization scheme and are pinned to the region’s `www.zohoapis.*` origin (API path `/crm/v8`).

## Run locally

```bash
pnpm --filter @osva-ai/connector-zoho-crm build
pnpm --filter @osva-ai/connector-zoho-crm test
```

```bash
OSVA_CONNECTOR_ZOHO_CRM_ACCESS_TOKEN=... \
OSVA_CONNECTOR_ZOHO_CRM_REGION=us \
osva-connector-zoho-crm
```

## Mutation safety

- Deal mutations require a non-empty `OSVA_CONNECTOR_ZOHO_CRM_ALLOWED_RESOURCE_IDS` allowlist, plus `NOTES_ENABLED` or `STATUS_ENABLED` and `HOST_WRITES_APPROVED`.
- `deal.note.add` always sends `"$is_shared_to_client": false` in the API body; that flag is not accepted in tool input.
- Stage updates validate against `OSVA_CONNECTOR_ZOHO_CRM_ALLOWED_TARGET_STATUSES` when set.

## License

Apache-2.0
