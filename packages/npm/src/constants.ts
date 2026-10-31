export const CONNECTOR_KEY = "osva-connector-npm";
export const CONNECTOR_NAME = "OSVA npm Connector";
export const CONNECTOR_VERSION = "0.1.0";

export const NPM_PACKAGE_METADATA_TOOL = "npm_package_metadata";
export const NPM_DOWNLOADS_TOOL = "npm_downloads";

export const NPM_REGISTRY_ORIGIN = "https://registry.npmjs.org";
export const NPM_DOWNLOADS_ORIGIN = "https://api.npmjs.org";

export const NPM_TIMEOUT_MS_ENV = "OSVA_CONNECTOR_NPM_TIMEOUT_MS";

export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
export const MIN_REQUEST_TIMEOUT_MS = 1_000;
export const MAX_REQUEST_TIMEOUT_MS = 60_000;

/** Maximum raw HTTP response bytes read before JSON parsing. */
export const MAX_HTTP_RESPONSE_BYTES = 2_097_152;

export const DEFAULT_NPM_USER_AGENT = `@osva-ai/connector-npm/${CONNECTOR_VERSION}`;
