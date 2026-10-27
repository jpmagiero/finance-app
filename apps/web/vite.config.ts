import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const config = loadEnv(mode, process.cwd(), "API_");
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@finance/shared": fileURLToPath(
          new URL("../../packages/shared/src/index.ts", import.meta.url),
        ),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target:
            process.env.API_PROXY_TARGET ?? config.API_PROXY_TARGET ?? "http://127.0.0.1:3333",
          changeOrigin: false,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
