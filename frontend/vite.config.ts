import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
// NOTE: Legacy plugin removed due to version conflict with current Vite (v5). If Pi Browser
// requires polyfills, consider upgrading Vite or adding manual polyfills (fetch, Promise, etc.).
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Slightly lower target may help older WebViews while keeping bundle reasonable
    target: "es2020",
  },
}));
