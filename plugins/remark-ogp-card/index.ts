import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Impit } from "impit";
import type { Paragraph, Root } from "mdast";
import { visit } from "unist-util-visit";

interface OgpData {
	title: string;
	description: string;
	image: string;
	localImage?: string;
	url: string;
}

interface Options {
	cache?: boolean;
	cacheDir?: string;
	thumbnailPosition?: "left" | "right";
}

const defaultOptions: Required<Options> = {
	cache: true,
	cacheDir: "public/ogp-cache",
	thumbnailPosition: "left",
};

// Memory cache to prevent duplicate requests during build
const memoryCache = new Map<string, OgpData>();

function hash(str: string): string {
	return createHash("sha256").update(str).digest("hex").slice(0, 16);
}

function getMetaCachePath(url: string, cacheDir: string): string {
	return join(cacheDir, `${hash(url)}.json`);
}

function getImageCachePath(imageUrl: string, cacheDir: string): string {
	const ext =
		imageUrl.match(/\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i)?.[1] ?? "png";
	return join(cacheDir, `${hash(imageUrl)}.${ext}`);
}

function loadFromDiskCache(url: string, cacheDir: string): OgpData | null {
	const path = getMetaCachePath(url, cacheDir);
	if (!existsSync(path)) return null;
	try {
		return JSON.parse(readFileSync(path, "utf-8"));
	} catch {
		return null;
	}
}

function saveToDiskCache(data: OgpData, cacheDir: string): void {
	if (!existsSync(cacheDir)) {
		mkdirSync(cacheDir, { recursive: true });
	}
	writeFileSync(
		getMetaCachePath(data.url, cacheDir),
		JSON.stringify(data, null, 2),
	);
}

async function downloadImage(
	imageUrl: string,
	cacheDir: string,
): Promise<string | null> {
	const localPath = getImageCachePath(imageUrl, cacheDir);
	if (existsSync(localPath)) {
		return "/" + localPath.replace(/^public\//, "");
	}

	try {
		const impit = new Impit({ browser: "chrome" });
		const res = await impit.fetch(imageUrl);
		if (!res.ok) return null;

		const buffer = Buffer.from(await res.arrayBuffer());
		if (!existsSync(cacheDir)) {
			mkdirSync(cacheDir, { recursive: true });
		}
		writeFileSync(localPath, buffer);
		return "/" + localPath.replace(/^public\//, "");
	} catch (e) {
		console.error(`[remark-ogp-card] Failed to download image ${imageUrl}:`, e);
		return null;
	}
}

async function fetchOgp(
	url: string,
	options: Required<Options>,
): Promise<OgpData | null> {
	// 1. Memory cache
	if (memoryCache.has(url)) {
		return memoryCache.get(url)!;
	}

	// 2. Disk cache
	if (options.cache) {
		const cached = loadFromDiskCache(url, options.cacheDir);
		if (cached) {
			memoryCache.set(url, cached);
			return cached;
		}
	}

	// 3. Fetch
	try {
		const impit = new Impit({ browser: "chrome" });
		const res = await impit.fetch(url);
		const html = await res.text();

		const title =
			html.match(/property="og:title".*?content="([^"]+)"/)?.[1] ??
			html.match(/<title>([^<]+)<\/title>/)?.[1] ??
			new URL(url).hostname;
		const description =
			html.match(/property="og:description".*?content="([^"]+)"/)?.[1] ?? "";
		const image =
			html.match(/property="og:image".*?content="([^"]+)"/)?.[1] ?? "";

		// 4. Download image
		let localImage: string | undefined;
		if (image && options.cache) {
			localImage = (await downloadImage(image, options.cacheDir)) ?? undefined;
		}

		const data: OgpData = { title, description, image, localImage, url };

		// 5. Save to cache
		memoryCache.set(url, data);
		if (options.cache) {
			saveToDiskCache(data, options.cacheDir);
		}

		return data;
	} catch (e) {
		console.error(`[remark-ogp-card] Failed to fetch ${url}:`, e);
		return null;
	}
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function createCardHtml(data: OgpData, options: Required<Options>): string {
	const { title, description, localImage, image, url } = data;
	const imageSrc = localImage ?? image;

	const thumbnail = imageSrc
		? `<div class="ogp-card__thumbnail"><img src="${imageSrc}" alt="" /></div>`
		: "";

	const content = `
    <div class="ogp-card__content">
      <div class="ogp-card__title">${escapeHtml(title)}</div>
      <div class="ogp-card__description">${escapeHtml(description)}</div>
      <div class="ogp-card__url">${new URL(url).hostname}</div>
    </div>
  `;

	const inner =
		options.thumbnailPosition === "left"
			? `${thumbnail}${content}`
			: `${content}${thumbnail}`;

	return `
<div class="ogp-card">
  <a href="${url}" target="_blank" rel="noreferrer noopener" class="ogp-card__link">
    ${inner}
  </a>
</div>`.trim();
}

function isStandaloneUrl(paragraph: Paragraph): string | null {
	if (paragraph.children.length !== 1) return null;

	const child = paragraph.children[0];
	if (child.type === "link" && child.children.length === 1) {
		const text = child.children[0];
		if (text.type === "text" && text.value === child.url) {
			return child.url;
		}
	}
	if (child.type === "text") {
		const match = child.value.match(/^https?:\/\/[^\s]+$/);
		if (match) return match[0];
	}
	return null;
}

export default function remarkOgpCard(userOptions: Options = {}) {
	const options: Required<Options> = { ...defaultOptions, ...userOptions };

	return async (tree: Root) => {
		const transformers: Array<() => Promise<void>> = [];

		visit(tree, "paragraph", (node, index, parent) => {
			if (parent?.type !== "root" || index === undefined) return;

			const url = isStandaloneUrl(node);
			if (!url) return;

			transformers.push(async () => {
				const data = await fetchOgp(url, options);
				if (data) {
					const html = createCardHtml(data, options);
					// biome-ignore lint/suspicious/noExplicitAny: mdast types don't include html node
					parent.children[index] = { type: "html", value: html } as any;
				}
			});
		});

		await Promise.all(transformers.map((t) => t()));
	};
}
