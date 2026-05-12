import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      includeAssets: ["favicon.svg", "apple-touch-icon.png", "pwa-192x192.png", "pwa-512x512.png"],
      manifest: {
        background_color: "#ffffff",
        description: "Личная библиотека фильмов и сериалов.",
        display: "standalone",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            purpose: "maskable",
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
        lang: "ru",
        name: "Cinema Library",
        short_name: "Cinema",
        start_url: "/",
        theme_color: "#ffffff",
      },
      registerType: "prompt",
      workbox: {
        globPatterns: ["**/*.{css,html,js,png,svg,woff2}"],
        navigateFallback: "/index.html",
      },
    }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    proxy: {
      "/api": {
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        target: "http://localhost:3001",
      },
    },
  },
});
