import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";

type HealthCheckState = {
  error?: string;
  response?: string;
  status: "idle" | "loading" | "success" | "error";
};

function App() {
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

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-5 p-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Cinema Library</p>
        <h1 className="text-3xl font-semibold tracking-normal">Frontend + Backend</h1>
      </div>

      <div className="space-y-3">
        <Button onClick={checkHealth} disabled={healthCheck.status === "loading"}>
          {healthCheck.status === "loading" ? "Проверяю..." : "Проверить /api/health"}
        </Button>

        <HealthCheckResult healthCheck={healthCheck} />
      </div>
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
