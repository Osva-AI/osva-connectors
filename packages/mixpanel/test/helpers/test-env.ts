import {
  createMixpanelRestClient,
  createStaticMixpanelAuthProvider,
  type MixpanelConfig,
} from "../../src/index.js";
import {
  FAKE_MIXPANEL_SECRET,
  FAKE_MIXPANEL_USERNAME,
  MOCK_PROJECT_ID,
  type MockMixpanelHttpServer,
} from "../fixtures/mock-mixpanel-http-server.js";

export function createTestMixpanelClient(server: MockMixpanelHttpServer) {
  const authProvider = createStaticMixpanelAuthProvider(
    FAKE_MIXPANEL_USERNAME,
    FAKE_MIXPANEL_SECRET,
  );
  return createMixpanelRestClient({
    authProvider,
    projectId: MOCK_PROJECT_ID,
    region: "us",
    requestTimeoutMs: 5_000,
    queryApiHost: server.queryApiOrigin,
  });
}

export function createTestMixpanelConfig(
  overrides: Partial<MixpanelConfig> = {},
): MixpanelConfig {
  return {
    serviceAccountUsername: FAKE_MIXPANEL_USERNAME,
    serviceAccountSecret: FAKE_MIXPANEL_SECRET,
    projectId: MOCK_PROJECT_ID,
    region: "us",
    requestTimeoutMs: 5_000,
    ...overrides,
  };
}

export { FAKE_MIXPANEL_SECRET, FAKE_MIXPANEL_USERNAME, MOCK_PROJECT_ID };
