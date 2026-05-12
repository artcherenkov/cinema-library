import type { Hono } from "hono";

function registerHealth(app: Hono): void {
  app.get("/health", (context) => {
    return context.json({ status: "ok" });
  });
}

export { registerHealth };
