import type { OidcClient } from "../auth/oidc-client.js";
import { createPkcePair, createRandomUrlToken } from "../auth/pkce.js";
import type { SessionsService } from "./sessions.js";
import type { AuthUser, UsersService } from "./users.js";

const loginFlowMaxAgeMs = 10 * 60 * 1000;

type LoginFlow = {
  codeVerifier: string;
  expiresAt: number;
  returnTo: string;
  state: string;
};

type AuthService = {
  finishTelegramLogin(params: {
    code: string;
    flow: LoginFlow;
    now: Date;
    state: string;
  }): Promise<{ expiresAt: Date; returnTo: string; sessionToken: string; user: AuthUser }>;
  getCurrentUser(token: string | undefined, now: Date): Promise<AuthUser | null>;
  logout(token: string | undefined, now: Date): Promise<void>;
  startTelegramLogin(
    returnTo: string,
    now: Date,
  ): {
    authorizationUrl: string;
    flow: LoginFlow;
  };
};

function createAuthService(dependencies: {
  oidcClient: OidcClient;
  sessionsService: SessionsService;
  usersService: UsersService;
}): AuthService {
  const { oidcClient, sessionsService, usersService } = dependencies;

  return {
    async finishTelegramLogin(params) {
      assertLoginFlow(params.flow, params.state, params.now);

      const identity = await oidcClient.exchangeCode(params.code, params.flow.codeVerifier);
      const user = await usersService.findOrCreateTelegramUser(identity, params.now);
      const session = await sessionsService.createSession(user.userId, params.now);

      return {
        expiresAt: session.expiresAt,
        returnTo: params.flow.returnTo,
        sessionToken: session.token,
        user,
      };
    },

    getCurrentUser(token, now) {
      return sessionsService.findCurrentUser(token, now);
    },

    logout(token, now) {
      return sessionsService.revokeSession(token, now);
    },

    startTelegramLogin(returnTo, now) {
      const pkce = createPkcePair();
      const state = createRandomUrlToken();
      const flow: LoginFlow = {
        codeVerifier: pkce.codeVerifier,
        expiresAt: now.getTime() + loginFlowMaxAgeMs,
        returnTo,
        state,
      };

      return {
        authorizationUrl: oidcClient.createAuthorizationUrl({
          codeChallenge: pkce.codeChallenge,
          state,
        }),
        flow,
      };
    },
  };
}

function assertLoginFlow(flow: LoginFlow, state: string, now: Date): void {
  if (flow.expiresAt <= now.getTime()) {
    throw new Error("Telegram login flow expired.");
  }

  if (flow.state !== state) {
    throw new Error("Telegram login state mismatch.");
  }
}

export { createAuthService };
export type { AuthService, LoginFlow };
