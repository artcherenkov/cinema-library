import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const telegramIssuer = "https://oauth.telegram.org";
const telegramAuthorizationEndpoint = `${telegramIssuer}/auth`;
const telegramTokenEndpoint = `${telegramIssuer}/token`;
const telegramJwksEndpoint = `${telegramIssuer}/.well-known/jwks.json`;

type OidcClientConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type AuthorizationUrlParams = {
  codeChallenge: string;
  state: string;
};

type VerifiedTelegramIdentity = {
  name: string;
  pictureUrl: string;
  preferredUsername: string;
  sub: string;
  telegramUserId: string;
};

type TelegramIdTokenClaims = JWTPayload & {
  id?: number | string;
  name?: string;
  picture?: string;
  preferred_username?: string;
  sub: string;
};

type TokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  id_token?: unknown;
  token_type?: unknown;
};

class OidcClient {
  readonly #clientId: string;
  readonly #clientSecret: string;
  readonly #jwks = createRemoteJWKSet(new URL(telegramJwksEndpoint));
  readonly #redirectUri: string;

  constructor(config: OidcClientConfig) {
    this.#clientId = config.clientId;
    this.#clientSecret = config.clientSecret;
    this.#redirectUri = config.redirectUri;
  }

  createAuthorizationUrl(params: AuthorizationUrlParams): string {
    const url = new URL(telegramAuthorizationEndpoint);

    url.searchParams.set("client_id", this.#clientId);
    url.searchParams.set("redirect_uri", this.#redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid profile");
    url.searchParams.set("state", params.state);
    url.searchParams.set("code_challenge", params.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");

    return url.toString();
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<VerifiedTelegramIdentity> {
    const response = await fetch(telegramTokenEndpoint, {
      body: new URLSearchParams({
        client_id: this.#clientId,
        code,
        code_verifier: codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: this.#redirectUri,
      }),
      headers: {
        authorization: `Basic ${Buffer.from(`${this.#clientId}:${this.#clientSecret}`).toString(
          "base64",
        )}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });

    const responseBody: unknown = await response.json().catch(() => undefined);

    if (!response.ok) {
      throw new Error(`Telegram token endpoint failed with HTTP ${response.status}.`);
    }

    const idToken = readIdToken(responseBody);
    const claims = await this.#verifyIdToken(idToken);

    return toTelegramIdentity(claims);
  }

  async #verifyIdToken(idToken: string): Promise<TelegramIdTokenClaims> {
    const { payload } = await jwtVerify(idToken, this.#jwks, {
      audience: this.#clientId,
      issuer: telegramIssuer,
    });

    if (typeof payload.sub !== "string" || payload.sub === "") {
      throw new Error("Telegram ID token does not contain a valid sub claim.");
    }

    return payload as TelegramIdTokenClaims;
  }
}

function readIdToken(responseBody: unknown): string {
  if (!isTokenResponse(responseBody) || typeof responseBody.id_token !== "string") {
    throw new Error("Telegram token endpoint response does not contain id_token.");
  }

  return responseBody.id_token;
}

function isTokenResponse(value: unknown): value is TokenResponse {
  return typeof value === "object" && value !== null;
}

function toTelegramIdentity(claims: TelegramIdTokenClaims): VerifiedTelegramIdentity {
  return {
    name: normalizeClaim(claims.name),
    pictureUrl: normalizeClaim(claims.picture),
    preferredUsername: normalizeClaim(claims.preferred_username),
    sub: claims.sub,
    telegramUserId: claims.id === undefined ? "" : String(claims.id),
  };
}

function normalizeClaim(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export { OidcClient };
export type { VerifiedTelegramIdentity };
