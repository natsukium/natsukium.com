import { defineCollection } from "astro:content";
import { SITE } from "@config";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const TAGS = [
	"advent-calendar",
	"backup",
	"beancount",
	"dynamic-derivations",
	"emacs",
	"license",
	"literate-programming",
	"macos",
	"nix",
	"nixpkgs",
	"oss",
	"others",
	"plain-text-accounting",
	"rust",
	"snix",
] as const;

const blog = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
	schema: ({ image }) =>
		z.object({
			author: z.string().default(SITE.author),
			pubDatetime: z.date(),
			modDatetime: z.date().optional().nullable(),
			title: z.string(),
			featured: z.boolean().optional(),
			draft: z.boolean().optional(),
			tags: z.array(z.enum(TAGS)).default(["others"]),
			ogImage: image()
				.refine((img) => img.width >= 1200 && img.height >= 630, {
					message: "OpenGraph image must be at least 1200 X 630 pixels!",
				})
				.or(z.string())
				.optional(),
			description: z.string(),
			canonicalURL: z.string().optional(),
			editPost: z
				.object({
					disabled: z.boolean().optional(),
					url: z.string().optional(),
					text: z.string().optional(),
					appendFilePath: z.boolean().optional(),
				})
				.optional(),
		}),
});

export const collections = { blog };
