import { Buffer } from "node:buffer";

import type { Context } from "hono";
import { deleteCookie, getCookie, getSignedCookie, setCookie, setSignedCookie } from "hono/cookie";

import type { AppConfig } from "../config.js";
import type { LoginFlow } from "../services/auth.js";

const loginFlowCookieName = "cinema_library_login_flow";
const sessionCookieName = "cinema_library_session";

async function readLoginFlowCookie(context: Context, config: AppConfig): Promise<LoginFlow | null> {
  const value = await getSignedCookie(context, config.sessionSecret, loginFlowCookieName);

  if (value === false || value === undefined) {
    return null;
  }

  return parseLoginFlow(value);
}

async function setLoginFlowCookie(
  context: Context,
  config: AppConfig,
  flow: LoginFlow,
): Promise<void> {
  await setSignedCookie(context, loginFlowCookieName, encodeJson(flow), config.sessionSecret, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/auth/telegram",
    sameSite: "Lax",
    secure: config.cookieSecure,
  });
}

function clearLoginFlowCookie(context: Context, config: AppConfig): void {
  deleteCookie(context, loginFlowCookieName, {
    path: "/auth/telegram",
    secure: config.cookieSecure,
  });
}

function readSessionCookie(context: Context): string | undefined {
  return getCookie(context, sessionCookieName);
}

function setSessionCookie(
  context: Context,
  config: AppConfig,
  params: { expiresAt: Date; token: string },
): void {
  setCookie(context, sessionCookieName, params.token, {
    expires: params.expiresAt,
    httpOnly: true,
    maxAge: config.sessionMaxAgeSeconds,
    path: "/",
    sameSite: "Lax",
    secure: config.cookieSecure,
  });
}

function clearSessionCookie(context: Context, config: AppConfig): void {
  deleteCookie(context, sessionCookieName, {
    path: "/",
    secure: config.cookieSecure,
  });
}

function parseLoginFlow(value: string): LoginFlow | null {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!isLoginFlow(parsedValue)) {
    return null;
  }

  return parsedValue;
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function isLoginFlow(value: unknown): value is LoginFlow {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const flow = value as Record<string, unknown>;

  return (
    typeof flow.codeVerifier === "string" &&
    typeof flow.expiresAt === "number" &&
    typeof flow.returnTo === "string" &&
    typeof flow.state === "string"
  );
}

export {
  clearLoginFlowCookie,
  clearSessionCookie,
  readLoginFlowCookie,
  readSessionCookie,
  setLoginFlowCookie,
  setSessionCookie,
};
