import { describe, expect, it } from "vitest";
import { slugifyAll, slugifyStr } from "./slugify";

describe("slugifyStr", () => {
	it("converts to lowercase and replaces spaces with hyphens", () => {
		expect(slugifyStr("Hello World")).toBe("hello-world");
		expect(slugifyStr("TypeScript")).toBe("typescript");
	});

	it("replaces underscores with hyphens", () => {
		expect(slugifyStr("foo_bar")).toBe("foo-bar");
	});

	it("collapses consecutive separators into single hyphen", () => {
		expect(slugifyStr("foo   bar")).toBe("foo-bar");
	});

	it("trims leading and trailing hyphens", () => {
		expect(slugifyStr("  Hello  ")).toBe("hello");
	});

	it("preserves non-ASCII characters", () => {
		expect(slugifyStr("Nixと文芸的プログラミング")).toBe(
			"nixと文芸的プログラミング",
		);
	});

	it("handles edge cases", () => {
		expect(slugifyStr("")).toBe("");
		expect(slugifyStr("hello-world")).toBe("hello-world");
	});
});

describe("slugifyAll", () => {
	it("converts array of strings to slugs", () => {
		expect(slugifyAll(["Hello World", "TypeScript"])).toEqual([
			"hello-world",
			"typescript",
		]);
	});

	it("handles empty array", () => {
		expect(slugifyAll([])).toEqual([]);
	});
});
