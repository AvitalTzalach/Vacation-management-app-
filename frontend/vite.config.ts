/**
 * Vite configuration (dev server, build, plugins).
 *
 * Why the `/api` proxy: the app and the API then share one origin, so the browser applies no CORS
 * rules at all (no preflight). Calling CEF's dev server directly would depend on its fixed CORS
 * answer: `Access-Control-Allow-Headers: *` (the Fetch standard excludes `Authorization` from that
 * wildcard; Chromium tolerates it, stricter browsers may not) and no `PATCH` in the allowed methods.
 * `/api/auth/login` is forwarded to `http://localhost:8888/auth/login`.
 */
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    // "@/..." points to src/ (e.g. "@/components/StatusBadge.vue").
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8888",
        changeOrigin: true,
        // Strip the /api prefix: the backend routes are /auth/login, /vacation-requests, ...
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
