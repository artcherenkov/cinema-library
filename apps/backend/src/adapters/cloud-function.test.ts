import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toHonoRequest, type ApiGatewayEvent } from "./cloud-function.js";

describe("Cloud Function adapter", () => {
  it("forwards API Gateway v2 cookies as a Cookie header", () => {
    const request = toHonoRequest(
      createApiGatewayEvent({
        cookies: ["cinema_library_login_flow=flow-token", "cinema_library_session=session-token"],
      }),
    );

    assert.equal(
      request.headers.get("cookie"),
      "cinema_library_login_flow=flow-token; cinema_library_session=session-token",
    );
  });
});

function createApiGatewayEvent(overrides: Partial<ApiGatewayEvent> = {}): ApiGatewayEvent {
  return {
    body: "",
    headers: {},
    isBase64Encoded: false,
    rawPath: "/auth/telegram/callback",
    rawQueryString: "",
    requestContext: {
      http: {
        method: "GET",
      },
    },
    version: "2.0",
    ...overrides,
  };
}
