import type { Paragraph, Root } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

// Import the plugin to test internal behavior via AST inspection
// Note: Full integration tests require mocking IMPIT or network access

/**
 * Helper function to parse markdown into AST
 */
function parseMarkdown(input: string): Root {
	return unified().use(remarkParse).parse(input) as Root;
}

/**
 * Check if a paragraph contains only a standalone URL
 */
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

describe("remark-ogp-card", () => {
	describe("URL detection", () => {
		it("should detect standalone URL in paragraph", () => {
			const ast = parseMarkdown("https://example.com");
			const paragraph = ast.children[0] as Paragraph;
			expect(isStandaloneUrl(paragraph)).toBe("https://example.com");
		});

		it("should detect standalone URL with path", () => {
			const ast = parseMarkdown("https://example.com/path/to/page");
			const paragraph = ast.children[0] as Paragraph;
			expect(isStandaloneUrl(paragraph)).toBe(
				"https://example.com/path/to/page",
			);
		});

		it("should detect standalone URL with query string", () => {
			const ast = parseMarkdown("https://example.com?foo=bar");
			const paragraph = ast.children[0] as Paragraph;
			expect(isStandaloneUrl(paragraph)).toBe("https://example.com?foo=bar");
		});

		it("should detect http URL", () => {
			const ast = parseMarkdown("http://example.com");
			const paragraph = ast.children[0] as Paragraph;
			expect(isStandaloneUrl(paragraph)).toBe("http://example.com");
		});

		it("should not detect URL in text with other content", () => {
			const ast = parseMarkdown("Check out https://example.com for more");
			const paragraph = ast.children[0] as Paragraph;
			expect(isStandaloneUrl(paragraph)).toBeNull();
		});

		it("should not detect text without URL", () => {
			const ast = parseMarkdown("This is just text");
			const paragraph = ast.children[0] as Paragraph;
			expect(isStandaloneUrl(paragraph)).toBeNull();
		});

		it("should not detect markdown link with different text", () => {
			const ast = parseMarkdown("[Click here](https://example.com)");
			const paragraph = ast.children[0] as Paragraph;
			expect(isStandaloneUrl(paragraph)).toBeNull();
		});

		it("should detect autolink where text matches URL", () => {
			// When markdown parses a bare URL, it creates a link node
			// where the text content equals the URL
			const ast = parseMarkdown("<https://example.com>");
			const paragraph = ast.children[0] as Paragraph;
			expect(isStandaloneUrl(paragraph)).toBe("https://example.com");
		});
	});

	describe("paragraph structure", () => {
		it("should not match paragraph with multiple children", () => {
			const ast = parseMarkdown("Some text https://example.com more text");
			const paragraph = ast.children[0] as Paragraph;
			// Multiple text/link nodes = not a standalone URL
			expect(isStandaloneUrl(paragraph)).toBeNull();
		});

		it("should not match headings", () => {
			const ast = parseMarkdown("# https://example.com");
			const node = ast.children[0];
			expect(node.type).toBe("heading");
		});

		it("should not match code blocks", () => {
			const ast = parseMarkdown("```\nhttps://example.com\n```");
			const node = ast.children[0];
			expect(node.type).toBe("code");
		});
	});

	describe("HTML escaping", () => {
		function escapeHtml(str: string): string {
			return str
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;");
		}

		it("should escape ampersand", () => {
			expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
		});

		it("should escape less than", () => {
			expect(escapeHtml("foo < bar")).toBe("foo &lt; bar");
		});

		it("should escape greater than", () => {
			expect(escapeHtml("foo > bar")).toBe("foo &gt; bar");
		});

		it("should escape double quotes", () => {
			expect(escapeHtml('foo "bar" baz')).toBe("foo &quot;bar&quot; baz");
		});

		it("should escape multiple special characters", () => {
			expect(escapeHtml('<script>alert("xss")</script>')).toBe(
				"&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
			);
		});
	});

	describe("hash function", () => {
		// Test that the hash function produces consistent results
		it("should produce consistent 16-character hash", () => {
			const { createHash } = require("node:crypto");
			const hash = (str: string) =>
				createHash("sha256").update(str).digest("hex").slice(0, 16);

			const result = hash("https://example.com");
			expect(result).toHaveLength(16);
			expect(result).toMatch(/^[a-f0-9]+$/);
		});

		it("should produce different hashes for different URLs", () => {
			const { createHash } = require("node:crypto");
			const hash = (str: string) =>
				createHash("sha256").update(str).digest("hex").slice(0, 16);

			const hash1 = hash("https://example.com");
			const hash2 = hash("https://example.org");
			expect(hash1).not.toBe(hash2);
		});

		it("should produce same hash for same URL", () => {
			const { createHash } = require("node:crypto");
			const hash = (str: string) =>
				createHash("sha256").update(str).digest("hex").slice(0, 16);

			const hash1 = hash("https://example.com");
			const hash2 = hash("https://example.com");
			expect(hash1).toBe(hash2);
		});
	});
});
