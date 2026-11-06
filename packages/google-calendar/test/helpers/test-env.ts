import {
  createCalendarRestClient,
  createStaticBearerTokenProvider,
} from "../../src/index.js";
import {
  FAKE_CAL_ACCESS_TOKEN,
  type MockCalendarHttpServer,
} from "../fixtures/mock-calendar-http-server.js";

export function createTestCalendarClient(server: MockCalendarHttpServer) {
  const tokenProvider = createStaticBearerTokenProvider(FAKE_CAL_ACCESS_TOKEN);
  return createCalendarRestClient({
    tokenProvider,
    requestTimeoutMs: 5_000,
    calendarApiHost: server.calendarApiOrigin,
  });
}

export { FAKE_CAL_ACCESS_TOKEN };
