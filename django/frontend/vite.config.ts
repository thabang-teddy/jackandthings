import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // Must equal STATIC_URL + django-vite's static_url_prefix ("/static/" + "dist/")
  base: "/static/dist/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    outDir: "../static/dist",
    emptyOutDir: true,
    manifest: "manifest.json", // django-vite reads this
    rollupOptions: { input: "src/main.tsx" },
  },
  server: { port: 5173, strictPort: true, origin: "http://localhost:5173", cors: { origin: "http://localhost:8000" } },
});
