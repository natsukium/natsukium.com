export const slugifyStr = (str: string): string =>
	str
		.toLowerCase()
		.replace(/[\s_]+/g, "-")
		.replace(/^-+|-+$/g, "");

export const slugifyAll = (arr: string[]) => arr.map((str) => slugifyStr(str));
