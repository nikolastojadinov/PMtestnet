import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import legacy from "@vitejs/plugin-legacy";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    legacy({ targets: ["defaults", "not IE 11"] }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2018",
    cssCodeSplit: true,
  },
  // Map Netlify-style NEXT_PUBLIC_* env vars into import.meta.env at build time
  define: {
    'import.meta.env.NEXT_PUBLIC_PI_APP_ID': JSON.stringify(process.env.NEXT_PUBLIC_PI_APP_ID || ''),
    'import.meta.env.NEXT_PUBLIC_BACKEND_URL': JSON.stringify(process.env.NEXT_PUBLIC_BACKEND_URL || ''),
    'import.meta.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL || ''),
    'import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''),
    'import.meta.env.NEXT_PUBLIC_FRONTEND_URL': JSON.stringify(process.env.NEXT_PUBLIC_FRONTEND_URL || ''),
  },
}));
