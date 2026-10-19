export const TEST_SHOPIFY_TOKEN = "shpat_osva_test_fixture_0000000000000000";
export const TEST_SHOPIFY_SHOP = "osva-fixture.myshopify.com";

export function withTestShopifyEnv<T>(run: (env: NodeJS.ProcessEnv) => T): T {
  const env: NodeJS.ProcessEnv = {
    OSVA_CONNECTOR_SHOPIFY_SHOP: TEST_SHOPIFY_SHOP,
    OSVA_CONNECTOR_SHOPIFY_ACCESS_TOKEN: TEST_SHOPIFY_TOKEN,
  };
  return run(env);
}
