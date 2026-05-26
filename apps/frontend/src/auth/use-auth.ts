import { useCallback, useEffect, useState } from "react";

import { createTelegramLoginUrl, loadSession, logout, type AuthUser } from "./auth-api.ts";

type AuthState =
  | {
      error?: undefined;
      status: "checking";
      user: null;
    }
  | {
      error?: undefined;
      status: "authenticated";
      user: AuthUser;
    }
  | {
      error?: undefined;
      status: "unauthenticated";
      user: null;
    }
  | {
      error: string;
      status: "error";
      user: null;
    };

function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    status: "checking",
    user: null,
  });

  const refresh = useCallback(async () => {
    setAuthState({ status: "checking", user: null });

    try {
      const session = await loadSession();

      setAuthState(
        session.user === null
          ? { status: "unauthenticated", user: null }
          : { status: "authenticated", user: session.user },
      );
    } catch (error) {
      setAuthState({
        error: error instanceof Error ? error.message : "Неизвестная ошибка",
        status: "error",
        user: null,
      });
    }
  }, []);

  const startTelegramLogin = useCallback(() => {
    window.location.assign(
      createTelegramLoginUrl(`${window.location.pathname}${window.location.search}`),
    );
  }, []);

  const logoutCurrentSession = useCallback(async () => {
    await logout();
    setAuthState({ status: "unauthenticated", user: null });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    authState,
    logout: logoutCurrentSession,
    refresh,
    startTelegramLogin,
  };
}

export { useAuth };
export type { AuthState };
