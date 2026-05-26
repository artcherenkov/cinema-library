type AuthUser = {
  avatarUrl: string;
  displayName: string;
  userId: string;
};

type SessionResponse = {
  user: AuthUser | null;
};

async function loadSession(): Promise<SessionResponse> {
  const response = await fetch("/auth/session");

  if (!response.ok) {
    throw new Error(`Не удалось получить сессию: HTTP ${response.status}`);
  }

  return response.json() as Promise<SessionResponse>;
}

async function logout(): Promise<void> {
  const response = await fetch("/auth/logout", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Не удалось выйти: HTTP ${response.status}`);
  }
}

function createTelegramLoginUrl(returnTo = "/"): string {
  const url = new URL("/auth/telegram/start", window.location.origin);

  url.searchParams.set("return_to", returnTo);

  return `${url.pathname}${url.search}`;
}

export { createTelegramLoginUrl, loadSession, logout };
export type { AuthUser };
