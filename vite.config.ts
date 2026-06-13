import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["pwa-icon.svg"],
      manifest: {
        name: "Loco for Cocoa",
        short_name: "Loco Cocoa",
        description: "A cozy cinematic archive for very good sweets.",
        theme_color: "#260d0b",
        background_color: "#f7efe2",
        display: "standalone",
        start_url: ".",
        scope: ".",
        icons: [
          {
            src: "pwa-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webp,avif,woff2}"],
        globIgnores: ["**/ThreeDessert-*.js", "**/StudioPage-*.js"],
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
});
