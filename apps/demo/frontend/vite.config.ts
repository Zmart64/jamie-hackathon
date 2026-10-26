import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "SUPPORT_AGENT_");
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: {
      proxy: {
        "/api/support": {
          target: env.SUPPORT_AGENT_URL || "http://127.0.0.1:8000",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/support/, ""),
        },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test-setup.ts"],
      clearMocks: true,
    },
  };
});
