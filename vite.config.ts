import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  build: {
    outDir: "dist",
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@musclemap/")) return "musclemap";
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/scheduler/")) return "vendor-react";
          if (id.includes("node_modules/")) return "vendor-ui";
          if (id.includes("/app/interchange/") || id.includes("/app/persistence/")) return "data-layer";
          return undefined;
        },
      },
    },
  },
});
