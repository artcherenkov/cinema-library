import type { MiddlewareHandler } from "hono";

import type { CurrentUser, SessionsService } from "../services/sessions.js";
import { readSessionCookie } from "./cookies.js";

type AppVariables = {
  currentUser: CurrentUser | null;
};

function createUserMiddleware(sessionsService: SessionsService): MiddlewareHandler<{
  Variables: AppVariables;
}> {
  return async (context, next) => {
    const token = readSessionCookie(context);
    const currentUser = await sessionsService.findCurrentUser(token, new Date());

    context.set("currentUser", currentUser);

    await next();
  };
}

export { createUserMiddleware };
export type { AppVariables };
