import { Hono } from "hono";

import { registerHealth } from "./routes/health.js";

function createApp(): Hono {
  const app = new Hono();

  registerHealth(app);

  return app;
}

const app = createApp();

export { app, createApp };
