import { type CollectionEntry, getCollection } from "astro:content";
import type { APIRoute } from "astro";
import fs from "node:fs";
import path from "node:path";

export async function getStaticPaths() {
	const posts = await getCollection("blog", ({ data }) => !data.draft);

	return posts.map((post) => ({
		params: { slug: post.slug },
		props: { post },
	}));
}

export const GET: APIRoute = async ({ props }) => {
	const post = props.post as CollectionEntry<"blog">;

	const filePath = path.join(process.cwd(), "src/content/blog", post.id);

	try {
		const markdown = fs.readFileSync(filePath, "utf-8");

		return new Response(markdown, {
			headers: {
				"Content-Type": "text/markdown; charset=utf-8",
			},
		});
	} catch (error) {
		return new Response(
			`Markdown file not found\npost.id: ${post.id}\npost.slug: ${post.slug}\nAttempted path: ${filePath}`,
			{
				status: 404,
				headers: {
					"Content-Type": "text/plain; charset=utf-8",
				},
			},
		);
	}
};
