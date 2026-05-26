type AppConfig = {
  appBaseUrl: string;
  cookieSecure: boolean;
  sessionMaxAgeSeconds: number;
  sessionSecret: string;
  telegramClientId: string;
  telegramClientSecret: string;
  ydbConnectionString: string;
};

function readAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const appBaseUrl = readRequiredEnv(env, "APP_BASE_URL");

  const sessionSecret = readRequiredEnv(env, "SESSION_SECRET");

  assertMinLength("SESSION_SECRET", sessionSecret, 32);

  return {
    appBaseUrl,
    cookieSecure: readCookieSecure(env, appBaseUrl),
    sessionMaxAgeSeconds: readPositiveIntegerEnv(env, "SESSION_MAX_AGE_SECONDS", 60 * 60 * 24 * 30),
    sessionSecret,
    telegramClientId: readRequiredEnv(env, "TELEGRAM_CLIENT_ID"),
    telegramClientSecret: readRequiredEnv(env, "TELEGRAM_CLIENT_SECRET"),
    ydbConnectionString: readRequiredEnv(env, "YDB_CONNECTION_STRING"),
  };
}

function assertMinLength(name: string, value: string, minLength: number): void {
  if (value.length < minLength) {
    throw new Error(`Environment variable ${name} must be at least ${minLength} characters long.`);
  }
}

function readRequiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];

  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readPositiveIntegerEnv(
  env: NodeJS.ProcessEnv,
  name: string,
  defaultValue: number,
): number {
  const rawValue = env[name];

  if (rawValue === undefined || rawValue.trim() === "") {
    return defaultValue;
  }

  const value = Number.parseInt(rawValue, 10);

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer.`);
  }

  return value;
}

function readCookieSecure(env: NodeJS.ProcessEnv, appBaseUrl: string): boolean {
  const explicitValue = env.COOKIE_SECURE;

  if (explicitValue !== undefined) {
    return explicitValue === "1" || explicitValue.toLowerCase() === "true";
  }

  return new URL(appBaseUrl).protocol === "https:";
}

export { readAppConfig };
export type { AppConfig };
