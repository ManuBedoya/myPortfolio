// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://portfoliomanubedoya.netlify.app",
  integrations: [
    sitemap({
      // The form thank-you page is a utility page, not content.
      filter: (page) => !page.includes("/gracias/"),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
