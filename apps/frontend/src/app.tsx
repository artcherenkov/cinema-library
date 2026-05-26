import { LogIn, LogOut, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/auth/use-auth.ts";
import { Button } from "@/components/ui/button.tsx";

type HealthCheckState = {
  error?: string;
  response?: string;
  status: "idle" | "loading" | "success" | "error";
};

function App() {
  const auth = useAuth();
  const [healthCheck, setHealthCheck] = useState<HealthCheckState>({
    status: "idle",
  });

  const checkHealth = async () => {
    setHealthCheck({ status: "loading" });

    try {
      const response = await fetch("/api/health");
      const responseBody = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseBody}`);
      }

      setHealthCheck({
        response: responseBody,
        status: "success",
      });
      toast.success("Backend ответил");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка";

      setHealthCheck({
        error: message,
        status: "error",
      });
      toast.error("Backend недоступен");
    }
  };

  const handleLogout = async () => {
    try {
      await auth.logout();
      toast.success("Вы вышли из аккаунта");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка";

      toast.error(message);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Cinema Library</p>
        <h1 className="text-3xl font-semibold tracking-normal">Личная библиотека кино</h1>
      </header>

      <section className="space-y-4 rounded-md border bg-card p-5 text-card-foreground">
        <AuthContent auth={auth} onLogout={handleLogout} />
      </section>

      <section className="space-y-3 rounded-md border bg-card p-5 text-card-foreground">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-medium">Backend</h2>
            <p className="text-sm text-muted-foreground">Техническая проверка связи</p>
          </div>

          <Button
            className="shrink-0"
            onClick={checkHealth}
            disabled={healthCheck.status === "loading"}
            variant="outline"
          >
            <RefreshCw className={healthCheck.status === "loading" ? "animate-spin" : ""} />
            Проверить
          </Button>
        </div>

        <HealthCheckResult healthCheck={healthCheck} />
      </section>
    </div>
  );
}

function AuthContent({
  auth,
  onLogout,
}: {
  auth: ReturnType<typeof useAuth>;
  onLogout: () => void;
}) {
  if (auth.authState.status === "checking") {
    return <p className="text-sm text-muted-foreground">Проверяю сессию...</p>;
  }

  if (auth.authState.status === "error") {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-destructive">{auth.authState.error}</p>
        <Button onClick={auth.refresh} variant="outline">
          <RefreshCw />
          Повторить
        </Button>
      </div>
    );
  }

  if (auth.authState.status === "authenticated") {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Вы вошли через Telegram</p>
          <p className="truncate text-lg font-medium">{auth.authState.user.displayName}</p>
        </div>

        <Button onClick={onLogout} variant="outline">
          <LogOut />
          Выйти
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h2 className="text-lg font-medium">Вход</h2>
        <p className="text-sm text-muted-foreground">Продолжите через Telegram.</p>
      </div>

      <Button onClick={auth.startTelegramLogin}>
        <LogIn />
        Войти
      </Button>
    </div>
  );
}

function HealthCheckResult({ healthCheck }: { healthCheck: HealthCheckState }) {
  if (healthCheck.status === "idle") {
    return <p className="text-sm text-muted-foreground">Запрос еще не выполнялся.</p>;
  }

  if (healthCheck.status === "loading") {
    return <p className="text-sm text-muted-foreground">Жду ответ backend...</p>;
  }

  if (healthCheck.status === "error") {
    return <p className="text-sm text-destructive">{healthCheck.error}</p>;
  }

  return (
    <pre className="overflow-auto rounded-md bg-muted p-3 text-sm">{healthCheck.response}</pre>
  );
}

export default App;
