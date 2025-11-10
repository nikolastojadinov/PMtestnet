import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import legacy from "@vitejs/plugin-legacy";
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
    legacy({
      targets: ["defaults", "not IE 11", "Android >= 6", "iOS >= 12"],
      modernPolyfills: true,
      // Remove explicit polyfill list that caused resolution errors; rely on automatic injection
      renderLegacyChunks: true,
      // Generate a separate polyfills chunk
      polyfills: [
        'es.promise',
        'es.array.flat',
        'es.array.find',
      ],
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Let legacy plugin handle transpilation; keep a moderate target
    target: 'modules',
    cssCodeSplit: true,
  },
}));
