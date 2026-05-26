import { app } from "../app.js";

type ApiGatewayEvent = {
  version: "2.0";
  rawPath: string;
  rawQueryString: string;
  headers: Record<string, string | undefined>;
  requestContext: {
    http: {
      method: string;
    };
  };
  body: string;
  isBase64Encoded: boolean;
};

type CloudFunctionResponse = {
  statusCode: number;
  headers: Record<string, string>;
  multiValueHeaders?: Record<string, string[]>;
  body: string;
  isBase64Encoded: false;
};

const requestOrigin = "https://api-gateway.local";

async function handler(event: ApiGatewayEvent): Promise<CloudFunctionResponse> {
  assertSupportedEvent(event);

  const request = toHonoRequest(event);
  const response = await app.fetch(request);

  return toCloudFunctionResponse(response);
}

function assertSupportedEvent(event: ApiGatewayEvent): void {
  if (event.version !== "2.0") {
    throw new Error(`Unsupported API Gateway payload version: ${event.version}`);
  }
}

function toHonoRequest(event: ApiGatewayEvent): Request {
  const method = event.requestContext.http.method;
  const headers = toHonoRequestHeaders(event);

  return new Request(toHonoRequestUrl(event), {
    body: toHonoRequestBody(event, method),
    headers,
    method,
  });
}

function toHonoRequestUrl(event: ApiGatewayEvent): URL {
  const query = event.rawQueryString === "" ? "" : `?${event.rawQueryString}`;

  return new URL(`${event.rawPath}${query}`, requestOrigin);
}

function toHonoRequestHeaders(event: ApiGatewayEvent): Headers {
  const headers = new Headers();

  for (const [name, value] of Object.entries(event.headers)) {
    if (value !== undefined && shouldKeepRequestHeader(name)) {
      headers.append(name, value);
    }
  }

  return headers;
}

function shouldKeepRequestHeader(name: string): boolean {
  const normalizedName = name.toLowerCase();

  return normalizedName !== "host" && normalizedName !== "content-length";
}

function toHonoRequestBody(event: ApiGatewayEvent, method: string): BodyInit | undefined {
  if (method === "GET" || method === "HEAD" || event.body === "") {
    return undefined;
  }

  if (event.isBase64Encoded) {
    return Buffer.from(event.body, "base64");
  }

  return event.body;
}

async function toCloudFunctionResponse(response: Response): Promise<CloudFunctionResponse> {
  const { headers, multiValueHeaders } = toCloudFunctionHeaders(response.headers);

  const cloudFunctionResponse: CloudFunctionResponse = {
    headers,
    body: await response.text(),
    statusCode: response.status,
    isBase64Encoded: false,
  };

  if (multiValueHeaders !== undefined) {
    cloudFunctionResponse.multiValueHeaders = multiValueHeaders;
  }

  return cloudFunctionResponse;
}

function toCloudFunctionHeaders(headers: Headers): {
  headers: Record<string, string>;
  multiValueHeaders?: Record<string, string[]>;
} {
  const responseHeaders: Record<string, string> = {};
  const setCookieHeaders = readSetCookieHeaders(headers);

  headers.forEach((value, name) => {
    if (name.toLowerCase() !== "set-cookie") {
      responseHeaders[name] = value;
    }
  });

  if (setCookieHeaders.length === 0) {
    return { headers: responseHeaders };
  }

  return {
    headers: responseHeaders,
    multiValueHeaders: {
      "set-cookie": setCookieHeaders,
    },
  };
}

function readSetCookieHeaders(headers: Headers): string[] {
  const headersWithCookies = headers as Headers & {
    getSetCookie?: () => string[];
  };

  return headersWithCookies.getSetCookie?.() ?? [];
}

export { handler };
export type { ApiGatewayEvent, CloudFunctionResponse };
