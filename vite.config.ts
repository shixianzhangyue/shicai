import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(async () => ({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  build: {
    // Split heavy third-party libraries into their own chunks so each one is
    // only downloaded when a page actually needs it. Without this, everything
    // lands in one large vendor bundle (~2 MB).
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          if (id.includes("echarts")) return "echarts";
          if (id.includes("xlsx")) return "xlsx";
          if (id.includes("react-pdf") || id.includes("pdfjs-dist")) return "pdf";
          if (id.includes("@fullcalendar")) return "fullcalendar";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("lucide-react")) return "icons";
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/react-router") ||
            id.includes("/scheduler/")
          ) {
            return "react-vendor";
          }
        },
      },
    },
  },
}));
