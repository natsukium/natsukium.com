import { SITE } from "./src/config";
import { createCssVariablesTheme } from "shiki/core";
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import remarkCollapse from "remark-collapse";
import remarkHeadingMarkers from "remark-heading-markers";
import remarkOgpCard from "remark-ogp-card";
import remarkToc from "remark-toc";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { unified } from "@astrojs/markdown-remark";

const base16ShikiTheme = createCssVariablesTheme({
  name: "base16-css-vars",
  variablePrefix: "--shiki-",
  fontStyle: true,
});

// https://astro.build/config
// Use SITE_URL env var for preview deployments, fallback to production URL
export default defineConfig({
  site: process.env.SITE_URL || SITE.website,
  integrations: [react(), sitemap()],
  markdown: {
    processor: unified({
      remarkPlugins: [
        remarkToc,
        [
          remarkCollapse,
          {
            test: "Table of contents",
          },
        ],
        remarkHeadingMarkers,
        [remarkOgpCard, { thumbnailPosition: "left" }],
      ],
    }),
    shikiConfig: {
      theme: base16ShikiTheme,
      wrap: true,
    },
  },
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
    },
  },
  scopedStyleStrategy: "where",
});
