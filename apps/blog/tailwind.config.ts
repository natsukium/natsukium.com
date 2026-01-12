import { base16Tailwind } from "@donovanglover/base16-tailwind";
import typography from "@tailwindcss/typography";
import type { Config } from "tailwindcss";

const config: Config = {
	content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
	// Dynamically applied theme classes are not visible to Tailwind's content scanner,
	// so we safelist all base16-* classes to prevent purging during build.
	safelist: [{ pattern: /^base16-/ }],
	theme: {
		screens: {
			sm: "640px",
		},
		extend: {
			fontFamily: {
				sans: ["IBM Plex Sans JP", "sans-serif"],
				mono: ["IBM Plex Mono", "monospace"],
			},
			typography: {
				DEFAULT: {
					css: {
						pre: {
							color: false,
						},
						code: {
							color: false,
						},
					},
				},
			},
		},
	},
	plugins: [typography, base16Tailwind({ invert: true, withTypography: true })],
};

export default config;
