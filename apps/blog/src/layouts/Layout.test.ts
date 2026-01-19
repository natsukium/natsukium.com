import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import Layout from "./Layout.astro";

const BASE_URL = "https://natsukium.com";

describe("Layout OGP meta tags", () => {
	let container: Awaited<ReturnType<typeof AstroContainer.create>>;

	beforeAll(async () => {
		container = await AstroContainer.create();
	});

	const renderLayout = async (
		props: Record<string, unknown>,
		url = `${BASE_URL}/`,
	) => {
		return container.renderToString(Layout, {
			props: {
				canonicalURL: url,
				...props,
			},
			request: new Request(url),
			slots: { default: "<main>content</main>" },
		});
	};

	it("renders og:title meta tag", async () => {
		const result = await renderLayout({
			title: "Test Title",
			description: "Test Description",
		});

		expect(result).toContain('property="og:title"');
		expect(result).toContain('content="Test Title"');
	});

	it("renders og:description meta tag", async () => {
		const result = await renderLayout({
			title: "Test Title",
			description: "Test Description",
		});

		expect(result).toContain('property="og:description"');
		expect(result).toContain('content="Test Description"');
	});

	it("renders og:url meta tag with correct URL", async () => {
		const url = `${BASE_URL}/posts/test`;
		const result = await renderLayout(
			{
				title: "Test Title",
				description: "Test Description",
			},
			url,
		);

		expect(result).toContain('property="og:url"');
		expect(result).toMatch(
			/property="og:url"[^>]*content="https:\/\/natsukium\.com\/posts\/test"/,
		);
	});

	it("renders og:image meta tag with absolute URL", async () => {
		const result = await renderLayout({
			title: "Test Title",
			description: "Test Description",
			ogImage: `${BASE_URL}/test-image.png`,
		});

		expect(result).toContain('property="og:image"');
		expect(result).toMatch(/property="og:image"[^>]*content="https:\/\//);
	});

	it("renders og:type meta tag", async () => {
		const result = await renderLayout({
			title: "Test Title",
			description: "Test Description",
		});

		expect(result).toContain('property="og:type"');
	});

	it("renders twitter:card meta tag with name attribute (not property)", async () => {
		const result = await renderLayout({
			title: "Test Title",
			description: "Test Description",
		});

		// Twitter Card tags should use "name" attribute, not "property"
		expect(result).toContain('name="twitter:card"');
		expect(result).toContain('content="summary_large_image"');
	});

	it("renders twitter:title meta tag with name attribute", async () => {
		const result = await renderLayout({
			title: "Test Title",
			description: "Test Description",
		});

		expect(result).toContain('name="twitter:title"');
	});

	it("renders twitter:description meta tag with name attribute", async () => {
		const result = await renderLayout({
			title: "Test Title",
			description: "Test Description",
		});

		expect(result).toContain('name="twitter:description"');
	});

	it("renders twitter:image meta tag with name attribute and absolute URL", async () => {
		const result = await renderLayout({
			title: "Test Title",
			description: "Test Description",
			ogImage: `${BASE_URL}/test-image.png`,
		});

		expect(result).toContain('name="twitter:image"');
		expect(result).toMatch(/name="twitter:image"[^>]*content="https:\/\//);
	});

	it("renders article:published_time when pubDatetime is provided", async () => {
		const pubDate = new Date("2024-01-15T10:00:00Z");
		const result = await renderLayout({
			title: "Test Title",
			description: "Test Description",
			pubDatetime: pubDate,
		});

		expect(result).toContain('property="article:published_time"');
		expect(result).toContain("2024-01-15");
	});

	it("renders article:modified_time when modDatetime is provided", async () => {
		const pubDate = new Date("2024-01-15T10:00:00Z");
		const modDate = new Date("2024-01-20T10:00:00Z");
		const result = await renderLayout({
			title: "Test Title",
			description: "Test Description",
			pubDatetime: pubDate,
			modDatetime: modDate,
		});

		expect(result).toContain('property="article:modified_time"');
		expect(result).toContain("2024-01-20");
	});
});
