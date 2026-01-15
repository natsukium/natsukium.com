import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
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
export default defineConfig({
	site: SITE.website,
	integrations: [
		tailwind({
			applyBaseStyles: false,
		}),
		react(),
		sitemap(),
	],
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
		optimizeDeps: {
			exclude: ["@resvg/resvg-js"],
		},
	},
	scopedStyleStrategy: "where",
});
