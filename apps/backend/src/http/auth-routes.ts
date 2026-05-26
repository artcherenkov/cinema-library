import { Hono } from "hono";

import type { AppConfig } from "../config.js";
import type { AuthService } from "../services/auth.js";
import type { SessionsService } from "../services/sessions.js";
import {
  clearLoginFlowCookie,
  clearSessionCookie,
  readLoginFlowCookie,
  readSessionCookie,
  setLoginFlowCookie,
  setSessionCookie,
} from "./cookies.js";
import { createUserMiddleware, type AppVariables } from "./user-middleware.js";

type AuthRuntime = {
  authService: AuthService;
  config: AppConfig;
  sessionsService: SessionsService;
};

function createAuthRoutes(getRuntime: () => AuthRuntime): Hono<{ Variables: AppVariables }> {
  const auth = new Hono<{ Variables: AppVariables }>();

  auth.get("/telegram/start", async (context) => {
    const runtime = getRuntime();
    const returnTo = normalizeReturnTo(context.req.query("return_to"));
    const login = runtime.authService.startTelegramLogin(returnTo, new Date());

    await setLoginFlowCookie(context, runtime.config, login.flow);

    return context.redirect(login.authorizationUrl, 302);
  });

  auth.get("/telegram/callback", async (context) => {
    const runtime = getRuntime();
    const code = context.req.query("code");
    const state = context.req.query("state");
    const flow = await readLoginFlowCookie(context, runtime.config);

    clearLoginFlowCookie(context, runtime.config);

    if (code === undefined || state === undefined || flow === null) {
      return context.redirect(withAuthError(flow?.returnTo ?? "/"), 302);
    }

    try {
      const result = await runtime.authService.finishTelegramLogin({
        code,
        flow,
        now: new Date(),
        state,
      });

      setSessionCookie(context, runtime.config, {
        expiresAt: result.expiresAt,
        token: result.sessionToken,
      });

      return context.redirect(result.returnTo, 302);
    } catch {
      return context.redirect(withAuthError(flow.returnTo), 302);
    }
  });

  auth.get(
    "/session",
    async (context, next) => {
      if (readSessionCookie(context) === undefined) {
        context.set("currentUser", null);

        await next();
        return;
      }

      const runtime = getRuntime();
      const middleware = createUserMiddleware(runtime.sessionsService);

      await middleware(context, next);
    },
    (context) => {
      return context.json({
        user: context.get("currentUser"),
      });
    },
  );

  auth.post("/logout", async (context) => {
    const runtime = getRuntime();
    const token = readSessionCookie(context);

    await runtime.authService.logout(token, new Date());
    clearSessionCookie(context, runtime.config);

    return context.body(null, 204);
  });

  return auth;
}

function normalizeReturnTo(value: string | undefined): string {
  if (value === undefined || value === "" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  let url: URL;

  try {
    url = new URL(value, "http://local.app");
  } catch {
    return "/";
  }

  if (url.origin !== "http://local.app") {
    return "/";
  }

  return `${url.pathname}${url.search}`;
}

function withAuthError(returnTo: string): string {
  const url = new URL(normalizeReturnTo(returnTo), "http://local.app");

  url.searchParams.set("auth_error", "telegram");

  return `${url.pathname}${url.search}${url.hash}`;
}

export { createAuthRoutes };
export type { AuthRuntime };
