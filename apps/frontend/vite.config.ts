import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    proxy: {
      "/auth": {
        changeOrigin: true,
        target: "http://localhost:3001",
      },
      "/api": {
        changeOrigin: true,
        target: "http://localhost:3001",
      },
    },
  },
});
