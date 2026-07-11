export const slugifyStr = (str: string): string =>
  str
    .toLowerCase()
    .replaceAll(/[\s_]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");

export const slugifyAll = (arr: string[]) => arr.map((str) => slugifyStr(str));
