/**
 * B5.5C: Per-connector SaaS acceptance specs (priority connectors get policy mock paths).
 */
import { defaultValidateConfig, importDistModule } from "./saas-runner.mjs";

/** @typedef {{
 *   directory: string;
 *   loadConfigExport: string;
 *   validateConfig?: (config: object, meta: object) => { ok: boolean; detail: string };
 *   harnessAllowlistCheck?: () => { ok: boolean; detail: string };
 *   mockPolicyChecks?: (repoRoot: string) => Promise<Array<{ id: string; ok: boolean; detail: string }>>;
 *   runLiveRead?: (ctx: object) => Promise<{ ok: boolean; detail: string }>;
 *   filterMockVitest?: (files: string[], includeMock: boolean) => string[];
 *   vitestTimeoutMs?: number;
 * }} SaasConnectorSpec */

const LOAD_EXPORT_OVERRIDES = Object.freeze({
  "google-ads": "loadGoogleAdsConfig",
  "google-calendar": "loadGoogleCalendarConfig",
  "google-drive": "loadGoogleDriveConfig",
  "google-sheets": "loadGoogleSheetsConfig",
  "meta-ads": "loadMetaAdsConfig",
  "zoho-crm": "loadZohoConfig",
  woocommerce: "loadWoocommerceConfig",
  bigcommerce: "loadBigcommerceConfig",
  ga4: "loadGa4Config",
  gsc: "loadGscConfig",
  npm: "loadNpmConfig",
  onedrive: "loadOneDriveConfig",
  whatsapp: "loadWhatsAppConfig",
});

function loadExportForDirectory(directory) {
  if (LOAD_EXPORT_OVERRIDES[directory]) {
    return LOAD_EXPORT_OVERRIDES[directory];
  }
  const camel = directory
    .split("-")
    .map((part, index) =>
      index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join("");
  return `load${camel.charAt(0).toUpperCase()}${camel.slice(1)}Config`;
}

async function policyCheckThrow(id, fn, passDetail) {
  try {
    fn();
    return { id, ok: false, detail: `expected denial for ${id}` };
  } catch {
    return { id, ok: true, detail: passDetail };
  }
}

/** @type {Record<string, Partial<SaasConnectorSpec>>} */
const SAAS_SPEC_OVERRIDES = {
  github: {
    validateConfig(config) {
      const repoCount = config.allowedRepositories?.length ?? 0;
      return {
        ok: repoCount > 0,
        detail: `allowedRepositories=${repoCount}`,
      };
    },
    harnessAllowlistCheck() {
      const owner = process.env.OSVA_LIVE_PROVIDER_GITHUB_TEST_OWNER?.trim();
      const repo = process.env.OSVA_LIVE_PROVIDER_GITHUB_TEST_REPO?.trim();
      const allowlist =
        process.env.OSVA_CONNECTOR_GITHUB_ALLOWED_REPOSITORIES ?? "";
      const slug = `${owner}/${repo}`;
      const ok =
        Boolean(owner && repo) &&
        (allowlist.includes(slug) || allowlist.includes(repo));
      return {
        ok,
        detail: ok
          ? `${slug} in allowlist`
          : "test repo must match OSVA_CONNECTOR_GITHUB_ALLOWED_REPOSITORIES",
      };
    },
    async mockPolicyChecks(repoRoot) {
      const allow = await importDistModule(
        repoRoot,
        "github",
        "repository-allowlist.js",
      );
      return [
        await policyCheckThrow(
          "mock_policy_unauthorized_repo",
          () =>
            allow.assertGithubRepositoryAllowed("evil", "repo", [
              "octo/sandbox",
            ]),
          "unauthorized repository rejected",
        ),
      ];
    },
    async runLiveRead({ timeoutMs }) {
      const owner = process.env.OSVA_LIVE_PROVIDER_GITHUB_TEST_OWNER.trim();
      const repo = process.env.OSVA_LIVE_PROVIDER_GITHUB_TEST_REPO.trim();
      const token = process.env.OSVA_CONNECTOR_GITHUB_TOKEN.trim();
      const allowlist =
        process.env.OSVA_CONNECTOR_GITHUB_ALLOWED_REPOSITORIES ?? "";
      const slug = `${owner}/${repo}`;
      if (!allowlist.includes(slug) && !allowlist.includes(repo)) {
        return {
          ok: false,
          detail: `repository ${slug} must be listed in allowlist env`,
        };
      }
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        Math.min(timeoutMs, 30_000),
      );
      try {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}`,
          {
            headers: {
              Accept: "application/vnd.github+json",
              Authorization: `Bearer ${token}`,
              "User-Agent": "osva-live-provider-acceptance",
              "X-GitHub-Api-Version": "2022-11-28",
            },
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          return { ok: false, detail: `GitHub API ${response.status}` };
        }
        const body = await response.json();
        return {
          ok: true,
          detail: `repository.get ok: ${body.full_name ?? slug}`,
        };
      } finally {
        clearTimeout(timer);
      }
    },
    filterMockVitest(files, includeMock) {
      return files.filter(
        (f) => f !== "test/stdio-github.integration.test.ts" || includeMock,
      );
    },
    vitestTimeoutMs: 180_000,
  },
  stripe: {
    validateConfig(config) {
      const customers = config.allowedCustomerIds?.length ?? 0;
      return {
        ok: !config.allowLiveMode,
        detail: `test-mode only; allowedCustomers=${customers}; allowLiveMode=${config.allowLiveMode}`,
      };
    },
    async mockPolicyChecks(repoRoot) {
      const allow = await importDistModule(
        repoRoot,
        "stripe",
        "customer-allowlist.js",
      );
      return [
        await policyCheckThrow(
          "mock_policy_unauthorized_customer",
          () =>
            allow.assertStripeCustomerAllowed("cus_test_other", ["cus_test_a"]),
          "unauthorized Stripe customer rejected",
        ),
      ];
    },
  },
  shopify: {
    validateConfig(config) {
      return {
        ok: Boolean(config.shopDomain),
        detail: `shopDomain=${config.shopDomain ?? "unset"}`,
      };
    },
  },
  jira: {
    validateConfig(config) {
      const keys = config.allowedProjectKeys?.length ?? 0;
      return {
        ok: keys > 0 && !config.writeEnabled,
        detail: `allowedProjectKeys=${keys}; writeEnabled=${config.writeEnabled}`,
      };
    },
    async mockPolicyChecks(repoRoot) {
      const scope = await importDistModule(
        repoRoot,
        "jira",
        "project-allowlist.js",
      );
      const allowlist = scope.createProjectAllowlist(["SANDBOX"]);
      return [
        await policyCheckThrow(
          "mock_policy_unauthorized_project",
          () => scope.assertProjectAllowed(allowlist, "EVIL", "harness"),
          "unauthorized Jira project key rejected",
        ),
      ];
    },
  },
  linear: {
    validateConfig(config) {
      const teams = config.allowedTeamIds?.length ?? 0;
      return {
        ok: !config.writeEnabled || teams > 0,
        detail: `writeEnabled=${config.writeEnabled}; allowedTeamIds=${teams}`,
      };
    },
  },
  notion: {
    validateConfig(config) {
      return {
        ok: !config.writeEnabled,
        detail: `writeEnabled=${config.writeEnabled}; writeDepth=${config.writeDepth ?? "default"}`,
      };
    },
  },
  zendesk: {
    validateConfig(config) {
      return {
        ok: Boolean(config.subdomain),
        detail: `subdomain configured; hostWrites=${config.hostWritesApproved}`,
      };
    },
    async mockPolicyChecks(repoRoot) {
      const allow = await importDistModule(
        repoRoot,
        "zendesk",
        "id-allowlist.js",
      );
      const ticketAllowlist = allow.createNumericIdAllowlist([1001]);
      return [
        await policyCheckThrow(
          "mock_policy_unauthorized_ticket",
          () => allow.assertIdAllowed(ticketAllowlist, 999_999, "ticket"),
          "unauthorized Zendesk id rejected",
        ),
      ];
    },
  },
  firecrawl: {
    validateConfig(config) {
      return {
        ok:
          Number.isInteger(config.requestTimeoutMs) &&
          config.requestTimeoutMs > 0,
        detail: `requestTimeoutMs=${config.requestTimeoutMs}`,
      };
    },
  },
};

/**
 * @param {string} directory
 * @returns {SaasConnectorSpec}
 */
export function getSaasSpec(directory) {
  const override = SAAS_SPEC_OVERRIDES[directory] ?? {};
  return {
    directory,
    loadConfigExport: loadExportForDirectory(directory),
    validateConfig: override.validateConfig ?? defaultValidateConfig,
    harnessAllowlistCheck: override.harnessAllowlistCheck,
    mockPolicyChecks: override.mockPolicyChecks,
    runLiveRead: override.runLiveRead,
    filterMockVitest: override.filterMockVitest,
    vitestTimeoutMs: override.vitestTimeoutMs,
  };
}
