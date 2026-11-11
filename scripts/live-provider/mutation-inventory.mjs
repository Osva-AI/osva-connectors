/**
 * B5.5C: Machine-readable MCP tool mutation classification.
 * Unknown tools referenced in mutation scenarios must fail closed.
 */

export const MUTATION_CLASS = Object.freeze({
  READ_ONLY: "READ_ONLY",
  REVERSIBLE_MUTATION: "REVERSIBLE_MUTATION",
  IRREVERSIBLE_MUTATION: "IRREVERSIBLE_MUTATION",
  DESTRUCTIVE: "DESTRUCTIVE",
  FINANCIALLY_SENSITIVE: "FINANCIALLY_SENSITIVE",
  EXTERNAL_COMMUNICATION: "EXTERNAL_COMMUNICATION",
});

/** @type {Record<string, Record<string, readonly string[]>>} */
export const MUTATION_INVENTORY = Object.freeze({
  github: {
    "github.repository.get": [MUTATION_CLASS.READ_ONLY],
    "github.issue.list": [MUTATION_CLASS.READ_ONLY],
    "github.issue.get": [MUTATION_CLASS.READ_ONLY],
    "github.issue.create": [MUTATION_CLASS.REVERSIBLE_MUTATION],
    "github.issue.comment.create": [
      MUTATION_CLASS.REVERSIBLE_MUTATION,
      MUTATION_CLASS.EXTERNAL_COMMUNICATION,
    ],
  },
  stripe: {
    "stripe.account.get": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "stripe.balance.get": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "stripe.balance_transaction.list": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "stripe.charge.list": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "stripe.customer.get": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "stripe.invoice.list": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "stripe.payment_intent.get": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "stripe.payment_intent.list": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "stripe.refund.list": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "stripe.subscription.list": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
  },
  shopify: {
    "shopify.shop.get": [MUTATION_CLASS.READ_ONLY],
    "shopify.product.list": [MUTATION_CLASS.READ_ONLY],
    "shopify.product.get": [MUTATION_CLASS.READ_ONLY],
    "shopify.order.list": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "shopify.order.get": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "shopify.inventory_levels.list": [MUTATION_CLASS.READ_ONLY],
    "shopify.location.list": [MUTATION_CLASS.READ_ONLY],
  },
  woocommerce: {
    "woocommerce.product.list": [MUTATION_CLASS.READ_ONLY],
    "woocommerce.product.get": [MUTATION_CLASS.READ_ONLY],
    "woocommerce.order.list": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "woocommerce.order.get": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "woocommerce.product.update": [
      MUTATION_CLASS.REVERSIBLE_MUTATION,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "woocommerce.order.status.update": [
      MUTATION_CLASS.IRREVERSIBLE_MUTATION,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
  },
  bigcommerce: {
    "bigcommerce.product.list": [MUTATION_CLASS.READ_ONLY],
    "bigcommerce.product.get": [MUTATION_CLASS.READ_ONLY],
    "bigcommerce.order.list": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "bigcommerce.product.update": [
      MUTATION_CLASS.REVERSIBLE_MUTATION,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
    "bigcommerce.order.status.update": [
      MUTATION_CLASS.IRREVERSIBLE_MUTATION,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
  },
  zendesk: {
    "zendesk.ticket.get": [MUTATION_CLASS.READ_ONLY],
    "zendesk.ticket.list": [MUTATION_CLASS.READ_ONLY],
    "zendesk.ticket.note.add": [
      MUTATION_CLASS.REVERSIBLE_MUTATION,
      MUTATION_CLASS.EXTERNAL_COMMUNICATION,
    ],
    "zendesk.ticket.status.set": [
      MUTATION_CLASS.IRREVERSIBLE_MUTATION,
      MUTATION_CLASS.EXTERNAL_COMMUNICATION,
    ],
  },
  intercom: {
    "intercom.conversation.get": [MUTATION_CLASS.READ_ONLY],
    "intercom.conversation.list": [MUTATION_CLASS.READ_ONLY],
    "intercom.conversation.note.add": [
      MUTATION_CLASS.REVERSIBLE_MUTATION,
      MUTATION_CLASS.EXTERNAL_COMMUNICATION,
    ],
    "intercom.conversation.state.set": [
      MUTATION_CLASS.REVERSIBLE_MUTATION,
      MUTATION_CLASS.EXTERNAL_COMMUNICATION,
    ],
  },
  freshdesk: {
    "freshdesk.ticket.get": [MUTATION_CLASS.READ_ONLY],
    "freshdesk.ticket.list": [MUTATION_CLASS.READ_ONLY],
    "freshdesk.ticket.note.create": [
      MUTATION_CLASS.REVERSIBLE_MUTATION,
      MUTATION_CLASS.EXTERNAL_COMMUNICATION,
    ],
  },
  jira: {
    "jira.issue.get": [MUTATION_CLASS.READ_ONLY],
    "jira.issue.search": [MUTATION_CLASS.READ_ONLY],
    "jira.issue.create": [MUTATION_CLASS.REVERSIBLE_MUTATION],
    "jira.issue.update": [MUTATION_CLASS.REVERSIBLE_MUTATION],
    "jira.issue.comment.create": [
      MUTATION_CLASS.REVERSIBLE_MUTATION,
      MUTATION_CLASS.EXTERNAL_COMMUNICATION,
    ],
  },
  linear: {
    "linear.issue.list": [MUTATION_CLASS.READ_ONLY],
    "linear.team.list": [MUTATION_CLASS.READ_ONLY],
    "linear.issue.create": [MUTATION_CLASS.REVERSIBLE_MUTATION],
    "linear.issue.update": [MUTATION_CLASS.REVERSIBLE_MUTATION],
    "linear.comment.create": [
      MUTATION_CLASS.REVERSIBLE_MUTATION,
      MUTATION_CLASS.EXTERNAL_COMMUNICATION,
    ],
  },
  notion: {
    "notion.page.create": [MUTATION_CLASS.REVERSIBLE_MUTATION],
    "notion.page.update": [MUTATION_CLASS.REVERSIBLE_MUTATION],
    "notion.database.query": [MUTATION_CLASS.READ_ONLY],
  },
  outlook: {
    "outlook.message.list": [MUTATION_CLASS.READ_ONLY],
    "outlook.message.send": [
      MUTATION_CLASS.IRREVERSIBLE_MUTATION,
      MUTATION_CLASS.EXTERNAL_COMMUNICATION,
    ],
    "outlook.event.create": [MUTATION_CLASS.REVERSIBLE_MUTATION],
  },
  onedrive: {
    "onedrive.drive.item.list": [MUTATION_CLASS.READ_ONLY],
    "onedrive.drive.item.upload": [MUTATION_CLASS.REVERSIBLE_MUTATION],
  },
  teams: {
    "teams.channel.message.send": [
      MUTATION_CLASS.IRREVERSIBLE_MUTATION,
      MUTATION_CLASS.EXTERNAL_COMMUNICATION,
    ],
    "teams.chat.message.send": [
      MUTATION_CLASS.IRREVERSIBLE_MUTATION,
      MUTATION_CLASS.EXTERNAL_COMMUNICATION,
    ],
  },
  confluence: {
    "confluence.page.get": [MUTATION_CLASS.READ_ONLY],
    "confluence.page.create": [MUTATION_CLASS.REVERSIBLE_MUTATION],
    "confluence.page.update": [MUTATION_CLASS.REVERSIBLE_MUTATION],
  },
  ga4: {
    "ga4.property.list": [MUTATION_CLASS.READ_ONLY],
    "ga4.property.get": [MUTATION_CLASS.READ_ONLY],
    "ga4.metadata.get": [MUTATION_CLASS.READ_ONLY],
    "ga4.report.run": [MUTATION_CLASS.READ_ONLY],
    "ga4.report.realtime": [MUTATION_CLASS.READ_ONLY],
  },
  "google-ads": {
    "google_ads.customer.list": [MUTATION_CLASS.READ_ONLY],
    "google_ads.search.query": [
      MUTATION_CLASS.READ_ONLY,
      MUTATION_CLASS.FINANCIALLY_SENSITIVE,
    ],
  },
  mixpanel: {
    "mixpanel.event.export": [MUTATION_CLASS.READ_ONLY],
    "mixpanel.insight.query": [MUTATION_CLASS.READ_ONLY],
  },
  amplitude: {
    "amplitude.event.list": [MUTATION_CLASS.READ_ONLY],
    "amplitude.chart.query": [MUTATION_CLASS.READ_ONLY],
  },
  firecrawl: {
    "firecrawl.scrape": [MUTATION_CLASS.READ_ONLY],
    "firecrawl.crawl": [MUTATION_CLASS.READ_ONLY],
  },
  gmail: {
    "gmail.message.list": [MUTATION_CLASS.READ_ONLY],
    "gmail.message.send": [
      MUTATION_CLASS.IRREVERSIBLE_MUTATION,
      MUTATION_CLASS.EXTERNAL_COMMUNICATION,
    ],
    "gmail.draft.create": [MUTATION_CLASS.REVERSIBLE_MUTATION],
  },
  whatsapp: {
    "whatsapp.template.send": [
      MUTATION_CLASS.IRREVERSIBLE_MUTATION,
      MUTATION_CLASS.EXTERNAL_COMMUNICATION,
    ],
  },
});

export const SAAS_PRIORITY_T0 = Object.freeze([
  "github",
  "stripe",
  "shopify",
  "woocommerce",
  "bigcommerce",
  "zendesk",
  "intercom",
  "freshdesk",
  "jira",
  "linear",
  "notion",
]);

export const SAAS_PRIORITY_T1 = Object.freeze([
  "outlook",
  "onedrive",
  "teams",
  "confluence",
  "gmail",
  "google-drive",
  "google-calendar",
  "google-sheets",
]);

export const SAAS_PRIORITY_T2 = Object.freeze([
  "ga4",
  "google-ads",
  "mixpanel",
  "amplitude",
  "firecrawl",
  "meta-ads",
  "hubspot",
  "slack",
]);

/**
 * @param {string} directory
 * @returns {{ ok: boolean; detail: string; toolCount: number }}
 */
export function verifyMutationInventory(directory) {
  const inventory = MUTATION_INVENTORY[directory];
  if (inventory === undefined) {
    return {
      ok: true,
      detail:
        "no classified mutation tools (read-only / metadata-only connector)",
      toolCount: 0,
    };
  }
  const entries = Object.entries(inventory);
  for (const [tool, classes] of entries) {
    if (!Array.isArray(classes) || classes.length === 0) {
      return {
        ok: false,
        detail: `tool ${tool} has empty classification (fail closed)`,
        toolCount: entries.length,
      };
    }
    for (const cls of classes) {
      if (!Object.values(MUTATION_CLASS).includes(cls)) {
        return {
          ok: false,
          detail: `tool ${tool} has unknown class ${cls}`,
          toolCount: entries.length,
        };
      }
    }
  }
  return {
    ok: true,
    detail: `inventory covers ${entries.length} tools`,
    toolCount: entries.length,
  };
}

/**
 * @param {string} directory
 * @returns {string}
 */
export function mutationSummaryForMatrix(directory) {
  const inv = MUTATION_INVENTORY[directory];
  if (!inv) {
    return "read-only inventory pending / none";
  }
  const mutating = Object.values(inv).filter((classes) =>
    classes.some((c) => c !== MUTATION_CLASS.READ_ONLY),
  ).length;
  return `${Object.keys(inv).length} tools; ${mutating} mutation-capable`;
}
