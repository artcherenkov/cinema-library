import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: false,
  entry: {
    index: "src/index.ts",
    local: "src/adapters/local-server.ts",
  },
  format: ["cjs"],
  noExternal: ["hono", "jose", "@ydbjs/auth", "@ydbjs/core", "@ydbjs/query", "@ydbjs/value"],
  outDir: "dist",
  platform: "node",
  sourcemap: true,
  splitting: false,
  target: "node22",
});
