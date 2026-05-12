import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppShell } from "@/app-shell.tsx";
import { Toaster } from "@/components/ui/sonner.tsx";

// oxlint-disable-next-line import/no-unassigned-import
import "./index.css";
import App from "./app.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Toaster />
    <AppShell>
      <App />
    </AppShell>
  </StrictMode>,
);
