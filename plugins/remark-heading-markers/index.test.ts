import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import type { Root } from "mdast";
import remarkHeadingMarkers from "./index";

/**
 * Helper function to process markdown with the plugin
 */
async function processMarkdown(input: string): Promise<string> {
	const result = await unified()
		.use(remarkParse)
		.use(remarkHeadingMarkers)
		.use(remarkStringify)
		.process(input);

	return String(result);
}

/**
 * Helper function to get the AST after applying the plugin
 */
async function getAst(input: string): Promise<Root> {
	const processor = unified().use(remarkParse).use(remarkHeadingMarkers);

	const ast = processor.parse(input);
	const transformed = await processor.run(ast);

	return transformed as Root;
}

describe("remark-heading-markers", () => {
	describe("single heading levels", () => {
		it("should add # marker to h1 headings", async () => {
			const input = "# First Level";
			const output = await processMarkdown(input);
			expect(output.trim()).toBe("# # First Level");
		});

		it("should add ## marker to h2 headings", async () => {
			const input = "## Second Level";
			const output = await processMarkdown(input);
			expect(output.trim()).toBe("## ## Second Level");
		});

		it("should add ### marker to h3 headings", async () => {
			const input = "### Third Level";
			const output = await processMarkdown(input);
			expect(output.trim()).toBe("### ### Third Level");
		});

		it("should add #### marker to h4 headings", async () => {
			const input = "#### Fourth Level";
			const output = await processMarkdown(input);
			expect(output.trim()).toBe("#### #### Fourth Level");
		});

		it("should add ##### marker to h5 headings", async () => {
			const input = "##### Fifth Level";
			const output = await processMarkdown(input);
			expect(output.trim()).toBe("##### ##### Fifth Level");
		});

		it("should add ###### marker to h6 headings", async () => {
			const input = "###### Sixth Level";
			const output = await processMarkdown(input);
			expect(output.trim()).toBe("###### ###### Sixth Level");
		});
	});

	describe("multiple headings", () => {
		it("should add markers to all headings in a document", async () => {
			const input = `# Title

Some content here.

## Section One

More content.

### Subsection

Even more content.`;

			const output = await processMarkdown(input);
			const lines = output.trim().split("\n");

			expect(lines[0]).toBe("# # Title");
			expect(lines[4]).toBe("## ## Section One");
			expect(lines[8]).toBe("### ### Subsection");
		});

		it("should handle consecutive headings", async () => {
			const input = `## First
### Second
#### Third`;

			const output = await processMarkdown(input);
			const lines = output.trim().split("\n");

			expect(lines[0]).toBe("## ## First");
			expect(lines[2]).toBe("### ### Second");
			expect(lines[4]).toBe("#### #### Third");
		});
	});

	describe("headings with complex content", () => {
		it("should handle headings with multiple words", async () => {
			const input = "## This is a longer heading with multiple words";
			const output = await processMarkdown(input);
			expect(output.trim()).toBe(
				"## ## This is a longer heading with multiple words",
			);
		});

		it("should handle headings with inline code", async () => {
			const input = "## Heading with `code`";
			const output = await processMarkdown(input);
			expect(output.trim()).toBe("## ## Heading with `code`");
		});

		it("should handle headings with emphasis", async () => {
			const input = "## Heading with *emphasis*";
			const output = await processMarkdown(input);
			expect(output.trim()).toBe("## ## Heading with *emphasis*");
		});

		it("should handle headings with links", async () => {
			const input = "## Heading with [link](https://example.com)";
			const output = await processMarkdown(input);
			expect(output.trim()).toBe(
				"## ## Heading with [link](https://example.com)",
			);
		});
	});

	describe("edge cases", () => {
		it("should handle empty headings", async () => {
			const input = "##";
			const ast = await getAst(input);
			// Empty heading should not crash
			expect(ast).toBeDefined();
		});

		it("should not modify non-heading content", async () => {
			const input = "This is a paragraph with no headings.";
			const output = await processMarkdown(input);
			expect(output.trim()).toBe("This is a paragraph with no headings.");
		});

		it("should handle documents with only paragraphs", async () => {
			const input = `Paragraph one.

Paragraph two.

Paragraph three.`;

			const output = await processMarkdown(input);
			expect(output).toContain("Paragraph one");
			expect(output).toContain("Paragraph two");
			expect(output).toContain("Paragraph three");
			expect(output).not.toContain("##");
		});

		it("should handle mixed content", async () => {
			const input = `# Title

This is a paragraph.

- List item 1
- List item 2

## Section

Another paragraph.`;

			const output = await processMarkdown(input);
			expect(output).toContain("# # Title");
			expect(output).toContain("## ## Section");
			expect(output).toContain("This is a paragraph");
			expect(output).toContain("List item 1");
		});
	});

	describe("AST validation", () => {
		it("should modify the text node value in the AST", async () => {
			const input = "## Test Heading";
			const ast = await getAst(input);

			const heading = ast.children[0];
			expect(heading.type).toBe("heading");

			if (heading.type === "heading") {
				const textNode = heading.children[0];
				expect(textNode.type).toBe("text");

				if (textNode.type === "text") {
					expect(textNode.value).toBe("## Test Heading");
				}
			}
		});

		it("should preserve heading depth", async () => {
			const input = "### Level Three";
			const ast = await getAst(input);

			const heading = ast.children[0];
			expect(heading.type).toBe("heading");

			if (heading.type === "heading") {
				expect(heading.depth).toBe(3);
			}
		});
	});
});
