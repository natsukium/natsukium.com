import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import remarkCollapse from "remark-collapse";
import remarkHeadingMarkers from "remark-heading-markers";
import remarkOgpCard from "remark-ogp-card";
import remarkToc from "remark-toc";
import { createCssVariablesTheme } from "shiki/core";
import { SITE } from "./src/config";

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
		shikiConfig: {
			theme: base16ShikiTheme,
			wrap: true,
		},
	},
	vite: {
		// @ts-expect-error @tailwindcss/vite types reference Vite 7 while Astro 5 uses Vite 6
		plugins: [tailwindcss()],
		optimizeDeps: {
			exclude: ["@resvg/resvg-js"],
		},
	},
	scopedStyleStrategy: "where",
});
