import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      "/api/nasa-power": {
        target:      "https://power.larc.nasa.gov",
        changeOrigin: true,
        rewrite:     (path) => path.replace(/^\/api\/nasa-power/, "/api"),
      },
    },
  },
});