# Install `@osva-ai/connector-intercom`

Source-only until npm bootstrap (see [RELEASE-CHECKLIST-intercom.md](./RELEASE-CHECKLIST-intercom.md)).

```bash
npm install @osva-ai/connector-intercom@0.1.0
```

Required env: `OSVA_CONNECTOR_INTERCOM_ACCESS_TOKEN`, `OSVA_CONNECTOR_INTERCOM_REGION` (`us`/`eu`/`au`), `OSVA_CONNECTOR_INTERCOM_ADMIN_ID`. Mutations require `OSVA_CONNECTOR_INTERCOM_NOTES_ENABLED` / `OSVA_CONNECTOR_INTERCOM_STATUS_ENABLED`, `OSVA_CONNECTOR_INTERCOM_HOST_WRITES_APPROVED`, and `OSVA_CONNECTOR_INTERCOM_ALLOWED_RESOURCE_IDS` (conversation ids).
