import { getCollection } from "astro:content";
import { generateOgImageForSite } from "@utils/generateOgImages";
import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
	const posts = await getCollection("blog", ({ data }) => !data.draft);
	const postCount = posts.length;

	const tagCounts = new Map<string, number>();
	for (const post of posts) {
		for (const tag of post.data.tags) {
			tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
		}
	}
	const topTags = [...tagCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 3)
		.map(([tag]) => tag);

	return new Response(await generateOgImageForSite({ postCount, topTags }), {
		headers: { "Content-Type": "image/png" },
	});
};
