// Tailwind CSS v4 plugin that generates base16 theme classes.
// Replaces @donovanglover/base16-tailwind plugin which only supports v3.
// Reads YAML scheme files from the base16-tailwind package and generates
// .base16-* classes that set --b16-* CSS custom properties.
// Uses addBase instead of addUtilities so classes are always included
// and not tree-shaken, since they are applied dynamically via JavaScript.

import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { parse } from "yaml";

const BASE_KEYS = [
	"base00",
	"base01",
	"base02",
	"base03",
	"base04",
	"base05",
	"base06",
	"base07",
	"base08",
	"base09",
	"base0A",
	"base0B",
	"base0C",
	"base0D",
	"base0E",
	"base0F",
];

// With invert: true, base00 maps to 100 (dark bg), base07 maps to 800 (light fg)
const VAR_NAMES = [
	"100",
	"200",
	"300",
	"400",
	"500",
	"600",
	"700",
	"800",
	"red",
	"orange",
	"yellow",
	"green",
	"cyan",
	"blue",
	"purple",
	"pink",
];

function hexToRgbChannels(hex) {
	const clean = hex.replace("#", "");
	const r = parseInt(clean.slice(0, 2), 16);
	const g = parseInt(clean.slice(2, 4), 16);
	const b = parseInt(clean.slice(4, 6), 16);
	return `${r} ${g} ${b}`;
}

export default function ({ addBase }) {
	const require = createRequire(import.meta.url);
	const libPath = require.resolve("@donovanglover/base16-tailwind");
	const packageRoot = dirname(dirname(libPath));
	const schemesPath = join(packageRoot, "schemes/base16");

	const files = readdirSync(schemesPath).filter((f) => f.endsWith(".yaml"));

	for (const file of files) {
		const content = readFileSync(join(schemesPath, file), "utf-8");
		const scheme = parse(content);
		const slug = `base16-${file.replace(".yaml", "")}`;

		const cssVars = {};
		for (let i = 0; i < BASE_KEYS.length; i++) {
			const hex = scheme.palette[BASE_KEYS[i]];
			if (hex) {
				cssVars[`--b16-${VAR_NAMES[i]}`] = hexToRgbChannels(hex);
			}
		}

		addBase({ [`.${slug}`]: cssVars });
	}
}
