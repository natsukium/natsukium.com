import type { CollectionEntry } from "astro:content";
import postFilter from "./postFilter";
import { slugifyStr } from "./slugify";

interface Tag {
  tag: string;
  tagName: string;
  count: number;
}

const getUniqueTags = (posts: CollectionEntry<"blog">[]) => {
  const counts = posts
    .filter(postFilter)
    .flatMap((post) => post.data.tags)
    .reduce((acc, tagName) => {
      const tag = slugifyStr(tagName);
      return acc.set(tag, {
        tag,
        tagName,
        count: (acc.get(tag)?.count ?? 0) + 1,
      });
    }, new Map<string, Tag>());

  return [...counts.values()].toSorted((a, b) => {
    if (a.tag === "others") return 1;
    if (b.tag === "others") return -1;
    if (a.count !== b.count) return b.count - a.count;
    return a.tag.localeCompare(b.tag);
  });
};

export default getUniqueTags;
