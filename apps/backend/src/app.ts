import { Hono } from "hono";

import { OidcClient } from "./auth/oidc-client.js";
import { readAppConfig, type AppConfig } from "./config.js";
import { createAuthRoutes, type AuthRuntime } from "./http/auth-routes.js";
import type { AppVariables } from "./http/user-middleware.js";
import { YdbSessionsRepository } from "./repositories/sessions.js";
import { YdbUsersRepository } from "./repositories/users.js";
import { createAuthService } from "./services/auth.js";
import { createSessionsService } from "./services/sessions.js";
import { createUsersService } from "./services/users.js";
import { getYdbQueryClient } from "./ydb/client.js";

const app = new Hono<{ Variables: AppVariables }>();
const getAuthRuntime = createAuthRuntimeFactory();

app.get("/api/health", (context) => {
  return context.json({ status: "ok" });
});

app.route("/auth", createAuthRoutes(getAuthRuntime));

function createAuthRuntimeFactory(): () => AuthRuntime {
  let runtime: AuthRuntime | undefined;

  return () => {
    runtime ??= createAuthRuntime(readAppConfig());

    return runtime;
  };
}

function createAuthRuntime(config: AppConfig): AuthRuntime {
  const getQueryClient = () => getYdbQueryClient(config);
  const sessionsRepository = new YdbSessionsRepository(getQueryClient);
  const usersRepository = new YdbUsersRepository(getQueryClient);
  const sessionsService = createSessionsService(sessionsRepository, config.sessionMaxAgeSeconds);
  const usersService = createUsersService(usersRepository);
  const oidcClient = new OidcClient({
    clientId: config.telegramClientId,
    clientSecret: config.telegramClientSecret,
    redirectUri: new URL("/auth/telegram/callback", config.appBaseUrl).toString(),
  });

  return {
    authService: createAuthService({
      oidcClient,
      sessionsService,
      usersService,
    }),
    config,
    sessionsService,
  };
}

export { app };
