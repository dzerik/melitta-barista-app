import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: process.env.VITE_BASE ?? "/melitta/",
  server: {
    host: "0.0.0.0",
  },
  preview: {
    host: "0.0.0.0",
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Melitta Barista",
        short_name: "Melitta",
        description: "Control your Melitta Barista coffee machine",
        // The espresso ground the app actually paints, not black.
        theme_color: "#100e0c",
        background_color: "#100e0c",
        display: "standalone",
        orientation: "any",
        // Relative, so they resolve against wherever the manifest is served
        // from. Absolute paths sent every install to the site root, which is
        // a 404 on any deployment that is not at "/" (GitHub Pages, /melitta/).
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
    }),
  ],
});
