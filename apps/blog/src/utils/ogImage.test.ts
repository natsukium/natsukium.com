import { describe, expect, it } from "vitest";
import { getOgImageUrl } from "./ogImage";

describe("getOgImageUrl", () => {
	const origin = "https://natsukium.com";

	it("returns custom string ogImage URL as absolute URL", () => {
		const result = getOgImageUrl({
			ogImage: "custom-image.png",
			title: "Test Post",
			origin,
		});

		expect(result).toBe("https://natsukium.com/custom-image.png");
	});

	it("returns custom ogImage with src property as absolute URL", () => {
		const result = getOgImageUrl({
			ogImage: { src: "/images/custom.png" },
			title: "Test Post",
			origin,
		});

		expect(result).toBe("https://natsukium.com/images/custom.png");
	});

	it("falls back to slugified title when ogImage is null", () => {
		const result = getOgImageUrl({
			ogImage: null,
			title: "My Awesome Post",
			origin,
		});

		expect(result).toBe("https://natsukium.com/posts/my-awesome-post.png");
	});

	it("falls back to slugified title when ogImage is undefined", () => {
		const result = getOgImageUrl({
			ogImage: undefined,
			title: "Another Post Title",
			origin,
		});

		expect(result).toBe("https://natsukium.com/posts/another-post-title.png");
	});

	it("handles Japanese title correctly", () => {
		const result = getOgImageUrl({
			ogImage: undefined,
			title: "Nixと文芸的プログラミング",
			origin,
		});

		// URL encoding is applied to non-ASCII characters
		expect(result).toBe(
			`https://natsukium.com/posts/${encodeURIComponent("nixと文芸的プログラミング")}.png`,
		);
	});

	it("handles already absolute URL", () => {
		const result = getOgImageUrl({
			ogImage: "https://example.com/external-image.png",
			title: "Test Post",
			origin,
		});

		expect(result).toBe("https://example.com/external-image.png");
	});
});
