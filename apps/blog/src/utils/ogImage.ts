import { slugifyStr } from "./slugify";

interface OgImageOptions {
	ogImage?: string | { src: string } | null;
	title: string;
	origin: string;
}

/**
 * Generate OGP image URL for a blog post.
 * Falls back to `/posts/{slugified-title}.png` if no custom image is provided.
 */
export function getOgImageUrl({
	ogImage,
	title,
	origin,
}: OgImageOptions): string {
	const ogImageUrl = typeof ogImage === "string" ? ogImage : ogImage?.src;
	return new URL(ogImageUrl ?? `/posts/${slugifyStr(title)}.png`, origin).href;
}
